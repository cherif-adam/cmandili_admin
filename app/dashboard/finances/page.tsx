export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import FinanceCharts from "@/components/FinanceCharts";
import { TrendingUp, CircleDollarSign, Truck, UtensilsCrossed } from "lucide-react";

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

async function getFinanceData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("platform_fee, driver_fee_cut, created_at, status")
    .eq("status", "delivered")
    .gte("created_at", thirtyDaysAgo);

  const delivered = (orders ?? []);

  const totalRestaurantCommissions = delivered.reduce(
    (s, o) => s + (Number(o.platform_fee) || 0),
    0
  );
  const totalDriverCommissions = delivered.reduce(
    (s, o) => s + (Number(o.driver_fee_cut) || 0),
    0
  );
  const totalRevenue = totalRestaurantCommissions + totalDriverCommissions;

  const last7 = delivered.filter((o) => o.created_at >= sevenDaysAgo);
  const week7Revenue = last7.reduce(
    (s, o) => s + (Number(o.platform_fee) || 0) + (Number(o.driver_fee_cut) || 0),
    0
  );

  // Group by day
  const byDay: Record<string, { restaurant: number; driver: number }> = {};
  delivered.forEach((o) => {
    const day = o.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { restaurant: 0, driver: 0 };
    byDay[day].restaurant += Number(o.platform_fee) || 0;
    byDay[day].driver += Number(o.driver_fee_cut) || 0;
  });

  const dailyData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      "Restaurants (10%)": +v.restaurant.toFixed(3),
      "Livreurs (23%)": +v.driver.toFixed(3),
      Total: +(v.restaurant + v.driver).toFixed(3),
    }));

  // Settlements summary
  const { data: settlements } = await supabaseAdmin
    .from("settlements")
    .select("entity_type, amount, status, created_at")
    .gte("created_at", thirtyDaysAgo);

  const pendingByType: Record<string, number> = {};
  for (const s of settlements ?? []) {
    if (s.status === "pending" && s.amount < 0) {
      pendingByType[s.entity_type] =
        (pendingByType[s.entity_type] ?? 0) + Math.abs(s.amount);
    }
  }

  return {
    totalRevenue,
    totalRestaurantCommissions,
    totalDriverCommissions,
    week7Revenue,
    dailyData,
    pendingCollections: pendingByType,
  };
}

export default async function FinancesPage() {
  const [data, rates] = await Promise.all([getFinanceData(), getCommissionRates()]);
  const fmt = (n: number) => `${n.toFixed(3)} TND`;
  const pct = (r: number) => `${(r * 100).toFixed(0)}%`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Finances</h2>
        <p className="text-sm text-gray-400 mt-1">30 derniers jours</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Revenu total (30j)"
          value={fmt(data.totalRevenue)}
          icon={TrendingUp}
          color="green"
        />
        <StatsCard
          title="Semaine en cours"
          value={fmt(data.week7Revenue)}
          icon={CircleDollarSign}
          color="orange"
        />
        <StatsCard
          title="Commissions restaurants"
          value={fmt(data.totalRestaurantCommissions)}
          subtitle={`${pct(rates.restaurantRate)} du sous-total`}
          icon={UtensilsCrossed}
          color="purple"
        />
        <StatsCard
          title="Commissions livreurs"
          value={fmt(data.totalDriverCommissions)}
          subtitle={`${pct(rates.driverRate)} des frais livraison`}
          icon={Truck}
          color="blue"
        />
      </div>

      {/* Pending collections */}
      {Object.keys(data.pendingCollections).length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
          <h3 className="font-semibold text-red-400 mb-3">
            Collectes en attente
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(data.pendingCollections).map(([type, amount]) => (
              <div key={type} className="bg-gray-900/60 rounded-lg p-3">
                <p className="text-xs text-gray-400 capitalize">{type === "driver" ? "Livreurs" : "Restaurants"}</p>
                <p className="text-lg font-bold text-red-400">
                  {amount.toFixed(3)} TND
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">
          Revenus quotidiens (30 derniers jours)
        </h3>
        <FinanceCharts data={data.dailyData} />
      </div>
    </div>
  );
}

