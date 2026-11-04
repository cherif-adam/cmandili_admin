export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import { DEFAULT_MONEY_STEP, parseMoneyStep } from "@/lib/money-step";
import SettingsForm from "./SettingsForm";
import ChangePasswordForm from "./ChangePasswordForm";
import { Settings } from "lucide-react";
import PageHeader from "@/components/PageHeader";

async function getSettings() {
  const { data } = await supabaseAdmin
    .from("global_settings")
    .select("setting_key, setting_value")
    .in("setting_key", [
      "default_restaurant_commission_rate",
      "default_driver_commission_rate",
      "max_discount_percent",
      "money_rounding_step",
    ]);

  const map = Object.fromEntries((data ?? []).map((r) => [r.setting_key, parseFloat(r.setting_value)]));
  return {
    restaurantRate: map["default_restaurant_commission_rate"] ?? 0.10,
    driverRate: map["default_driver_commission_rate"] ?? 0.23,
    // Meme repli que l'app partenaire quand la ligne est illisible : 70 %.
    maxDiscountPercent: map["max_discount_percent"] ?? 70,
    // Meme repli que public.round_money quand la ligne manque : 50 millimes.
    moneyRoundingStep: parseMoneyStep(map["money_rounding_step"]) ?? DEFAULT_MONEY_STEP,
  };
}

export default async function ParametresPage() {
  const { restaurantRate, driverRate, maxDiscountPercent, moneyRoundingStep } =
    await getSettings();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <PageHeader
          icon={Settings}
          title="Paramètres"
          subtitle="Commissions, arrondi des montants, plafond de remise et mot de passe"
        />
      </div>

      <SettingsForm
        restaurantRate={restaurantRate}
        driverRate={driverRate}
        maxDiscountPercent={maxDiscountPercent}
        moneyRoundingStep={moneyRoundingStep}
      />

      {/* Le changement de mot de passe se fait entierement cote navigateur,
          avec le client utilisateur : le mot de passe actuel ne transite par
          aucun serveur, et supabaseAdmin pourrait le changer SANS verifier
          l'ancien, ce qui viderait le controle de son sens. */}
      <ChangePasswordForm />
    </div>
  );
}
