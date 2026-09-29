export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import SettingsForm from "./SettingsForm";
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
    ]);

  const map = Object.fromEntries((data ?? []).map((r) => [r.setting_key, parseFloat(r.setting_value)]));
  return {
    restaurantRate: map["default_restaurant_commission_rate"] ?? 0.10,
    driverRate: map["default_driver_commission_rate"] ?? 0.23,
    // Meme repli que l'app partenaire quand la ligne est illisible : 70 %.
    maxDiscountPercent: map["max_discount_percent"] ?? 70,
  };
}

export default async function ParametresPage() {
  const { restaurantRate, driverRate, maxDiscountPercent } = await getSettings();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <PageHeader
          icon={Settings}
          title="Paramètres"
          subtitle="Commissions de la plateforme et plafond de remise"
        />
      </div>

      <SettingsForm
        restaurantRate={restaurantRate}
        driverRate={driverRate}
        maxDiscountPercent={maxDiscountPercent}
      />
    </div>
  );
}
