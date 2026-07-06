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

  const { payout_id } = await req.json();
  if (!payout_id) {
    return NextResponse.json({ error: "Missing payout_id" }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from("loyalty_driver_payouts")
    .update({ status: "settled", settled_at: new Date().toISOString(), settled_by: user.id })
    .eq("id", payout_id)
    .eq("status", "pending")
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Payout not found or already settled" }, { status: 404 });

  await logAudit({
    admin_id: user.id,
    admin_email: user.email ?? "unknown",
    action_type: "settle_loyalty_payout",
    target_type: "loyalty_driver_payout",
    target_id: payout_id,
  });

  return NextResponse.json({ ok: true });
}
