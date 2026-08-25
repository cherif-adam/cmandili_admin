import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { driver_id, partner_id, customer_id, blocked } = body;

  if (typeof blocked !== "boolean") {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  if (driver_id) {
    const { data: driverRow, error } = await supabaseAdmin
      .from("drivers")
      .update({ is_blocked: blocked })
      .eq("id", driver_id)
      .select("user_id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mirror the manual (un)block onto the wallet so an automatic prepaid
    // top-up never silently un-blocks a manually banned account.
    if (driverRow?.user_id) {
      await supabaseAdmin
        .from("wallets")
        .update({
          status: blocked ? "blocked" : "active",
          blocked_reason: blocked ? "manual" : null,
        })
        .eq("user_id", driverRow.user_id);
    }

    await logAudit({
      admin_id: user.id,
      admin_email: user.email ?? "unknown",
      action_type: blocked ? "block_driver" : "unblock_driver",
      target_type: "driver",
      target_id: driver_id,
    });
    return NextResponse.json({ ok: true });
  }

  if (partner_id) {
    const { data: partnerRow, error } = await supabaseAdmin
      .from("partners")
      .update({ is_blocked: blocked })
      .eq("id", partner_id)
      .select("user_id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mirror the manual (un)block onto the wallet (see driver branch above).
    if (partnerRow?.user_id) {
      await supabaseAdmin
        .from("wallets")
        .update({
          status: blocked ? "blocked" : "active",
          blocked_reason: blocked ? "manual" : null,
        })
        .eq("user_id", partnerRow.user_id);
    }

    await logAudit({
      admin_id: user.id,
      admin_email: user.email ?? "unknown",
      action_type: blocked ? "block_restaurant" : "unblock_restaurant",
      target_type: "restaurant",
      target_id: partner_id,
    });
    return NextResponse.json({ ok: true });
  }

  if (customer_id) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_blocked: blocked })
      .eq("id", customer_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAudit({
      admin_id: user.id,
      admin_email: user.email ?? "unknown",
      action_type: blocked ? "block_customer" : "unblock_customer",
      target_type: "customer",
      target_id: customer_id,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Must provide driver_id, partner_id, or customer_id" }, { status: 400 });
}
