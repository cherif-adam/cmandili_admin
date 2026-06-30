import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { driver_id, partner_id, customer_id, blocked } = body;

  if (typeof blocked !== "boolean") {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  if (driver_id) {
    const { error } = await supabaseAdmin
      .from("drivers")
      .update({ is_blocked: blocked })
      .eq("id", driver_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
    const { error } = await supabaseAdmin
      .from("partners")
      .update({ is_blocked: blocked })
      .eq("id", partner_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
