import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { restaurant_rate, driver_rate } = body;

  if (
    typeof restaurant_rate !== "number" || restaurant_rate <= 0 || restaurant_rate >= 1 ||
    typeof driver_rate !== "number" || driver_rate <= 0 || driver_rate >= 1
  ) {
    return NextResponse.json({ error: "Les taux doivent être entre 0 et 1 (exclus)" }, { status: 400 });
  }

  const updates = [
    { setting_key: "default_restaurant_commission_rate", setting_value: restaurant_rate.toString() },
    { setting_key: "default_driver_commission_rate", setting_value: driver_rate.toString() },
  ];

  for (const u of updates) {
    const { error } = await supabaseAdmin
      .from("global_settings")
      .update({ setting_value: u.setting_value, updated_at: new Date().toISOString() })
      .eq("setting_key", u.setting_key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    admin_id: user.id,
    admin_email: user.email ?? "unknown",
    action_type: "update_commission_rates",
    target_type: "settings",
    details: { restaurant_rate, driver_rate },
  });
  return NextResponse.json({ ok: true });
}
