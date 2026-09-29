import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { restaurant_rate, driver_rate, max_discount_percent } = body;

  if (
    typeof restaurant_rate !== "number" || restaurant_rate <= 0 || restaurant_rate >= 1 ||
    typeof driver_rate !== "number" || driver_rate <= 0 || driver_rate >= 1
  ) {
    return NextResponse.json({ error: "Les taux doivent être entre 0 et 1 (exclus)" }, { status: 400 });
  }

  // Le plafond est un POURCENTAGE, pas un taux : c'est ainsi que l'app
  // partenaire le lit, et le convertir ici ferait plafonner les remises a
  // 0,7 %. Borne haute a 99 : un article a -100 % serait gratuit, et la
  // commission du partenaire porterait sur zero.
  if (
    typeof max_discount_percent !== "number" ||
    !Number.isFinite(max_discount_percent) ||
    max_discount_percent < 1 ||
    max_discount_percent > 99
  ) {
    return NextResponse.json(
      { error: "Le plafond de remise doit être entre 1 % et 99 %" },
      { status: 400 }
    );
  }

  const updates = [
    { setting_key: "default_restaurant_commission_rate", setting_value: restaurant_rate.toString() },
    { setting_key: "default_driver_commission_rate", setting_value: driver_rate.toString() },
    { setting_key: "max_discount_percent", setting_value: max_discount_percent.toString() },
  ];

  for (const u of updates) {
    // upsert et non update : max_discount_percent peut ne pas exister encore
    // sur une base ou la migration de la phase 1 n'est pas passee, et un
    // update muet n'aurait rien ecrit sans rien dire.
    const { error } = await supabaseAdmin
      .from("global_settings")
      .upsert(
        {
          setting_key: u.setting_key,
          setting_value: u.setting_value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "setting_key" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    admin_id: user.id,
    admin_email: user.email ?? "unknown",
    action_type: "update_commission_rates",
    target_type: "settings",
    details: { restaurant_rate, driver_rate, max_discount_percent },
  });
  return NextResponse.json({ ok: true });
}
