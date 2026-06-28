export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import SettingsForm from "./SettingsForm";
import { Settings } from "lucide-react";

async function getCommissionRates() {
  const { data } = await supabaseAdmin
    .from("global_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["default_restaurant_commission_rate", "default_driver_commission_rate"]);

  const map = Object.fromEntries((data ?? []).map((r) => [r.setting_key, parseFloat(r.setting_value)]));
  return {
    restaurantRate: map["default_restaurant_commission_rate"] ?? 0.10,
    driverRate: map["default_driver_commission_rate"] ?? 0.23,
  };
}

export default async function ParametresPage() {
  const { restaurantRate, driverRate } = await getCommissionRates();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings size={22} className="text-orange-400" />
        <div>
          <h2 className="text-2xl font-bold text-white">Paramètres</h2>
          <p className="text-sm text-gray-400 mt-0.5">Taux de commission de la plateforme</p>
        </div>
      </div>

      <SettingsForm restaurantRate={restaurantRate} driverRate={driverRate} />
    </div>
  );
}
