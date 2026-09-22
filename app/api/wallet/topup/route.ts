import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin, logAudit } from "@/lib/audit";

// Admin prepaid top-up: loads balance onto a restaurant (partner) or driver.
// A top-up is recorded as a POSITIVE `manual_topup` settlement; the DB trigger
// `update_wallet_balance` applies it to the wallet, and `enforce_prepaid_block`
// auto-unblocks the account if the new balance clears the floor (unless it was
// blocked manually).
export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { driver_id, partner_id, client_id, amount } = await req.json();

  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || value > 100000) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }
  if (!driver_id && !partner_id && !client_id) {
    return NextResponse.json(
      { error: "Must provide driver_id, partner_id or client_id" },
      { status: 400 }
    );
  }

  // Resolve the auth user_id + entity_type for the settlement row.
  let userId: string | null = null;
  let entityType: "driver" | "restaurant" | "client" | null = null;
  let targetType = "";

  if (client_id) {
    // A customer's wallet is keyed on their auth user id directly — there is
    // no drivers/partners row to resolve through. The balance trigger keys on
    // user_id alone and ignores entity_type, so crediting a client needs no
    // schema change; it is the same ledger the other two use.
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", client_id)
      .single();
    userId = data?.id ?? null;
    entityType = "client";
    targetType = "client";
  } else if (driver_id) {
    const { data } = await supabaseAdmin
      .from("drivers")
      .select("user_id")
      .eq("id", driver_id)
      .single();
    userId = data?.user_id ?? null;
    entityType = "driver";
    targetType = "driver";
  } else {
    const { data } = await supabaseAdmin
      .from("partners")
      .select("user_id")
      .eq("id", partner_id)
      .single();
    userId = data?.user_id ?? null;
    entityType = "restaurant";
    targetType = "restaurant";
  }

  if (!userId) {
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }

  const rounded = Math.round(value * 1000) / 1000; // TND millime precision

  const { error } = await supabaseAdmin.from("settlements").insert({
    user_id: userId,
    entity_type: entityType,
    amount: rounded,
    type: "manual_topup",
    description: "Recharge solde",
    status: "paid",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    admin_id: user.id,
    admin_email: user.email ?? "unknown",
    action_type: "wallet_topup",
    target_type: targetType,
    target_id: driver_id ?? partner_id,
    details: { amount: rounded },
  });

  return NextResponse.json({ ok: true, amount: rounded });
}
