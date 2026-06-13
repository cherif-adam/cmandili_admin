import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import RevenueChart from "@/components/RevenueChart";
import {
  Truck,
  UtensilsCrossed,
  ShoppingBag,
  TrendingUp,
  CircleDollarSign,
  Users,
} from "lucide-react";

async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ordersRes, driversRes, restaurantsRes, commissionsRes, revenueRes] =
    await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, status, platform_fee, driver_fee_cut, created_at")
        .gte("created_at", today.toISOString()),
      supabaseAdmin.from("drivers").select("id, is_online"),
      supabaseAdmin.from("restaurants").select("id"),
      supabaseAdmin
        .from("orders")
        .select("platform_fee, driver_fee_cut")
        .eq("status", "delivered")
        .gte("created_at", today.toISOString()),
      // Last 30 days revenue by day
      supabaseAdmin
        .from("orders")
        .select("platform_fee, driver_fee_cut, created_at")
        .eq("status", "delivered")
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
        ),
    ]);

  const todayOrders = ordersRes.data ?? [];
  const drivers = driversRes.data ?? [];
  const restaurants = restaurantsRes.data ?? [];
  const todayCommissions = commissionsRes.data ?? [];
  const revenueData = revenueRes.data ?? [];

  const todayRestaurantCommissions = todayCommissions.reduce(
    (s, o) => s + (Number(o.platform_fee) || 0),
    0
  );
  const todayDriverCommissions = todayCommissions.reduce(
    (s, o) => s + (Number(o.driver_fee_cut) || 0),
    0
  );

  // Group revenue by day for chart
  const byDay: Record<string, { restaurant: number; driver: number }> = {};
  revenueData.forEach((o) => {
    const day = o.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { restaurant: 0, driver: 0 };
    byDay[day].restaurant += Number(o.platform_fee) || 0;
    byDay[day].driver += Number(o.driver_fee_cut) || 0;
  });
  const chartData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, v]) => ({
      date,
      "Commissions restaurants": +v.restaurant.toFixed(3),
      "Commissions livreurs": +v.driver.toFixed(3),
    }));

  return {
    todayOrders: todayOrders.length,
    deliveredToday: todayOrders.filter((o) => o.status === "delivered").length,
    onlineDrivers: drivers.filter((d) => d.is_online).length,
    totalDrivers: drivers.length,
    totalRestaurants: restaurants.length,
    todayRestaurantCommissions,
    todayDriverCommissions,
    todayTotal: todayRestaurantCommissions + todayDriverCommissions,
    chartData,
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const fmt = (n: number) => `${n.toFixed(3)} TND`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Vue d&apos;ensemble</h2>
        <p className="text-sm text-gray-400 mt-1">
          {new Date().toLocaleDateString("fr-TN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Commandes aujourd'hui"
          value={stats.todayOrders}
          subtitle={`${stats.deliveredToday} livrées`}
          icon={ShoppingBag}
          color="blue"
        />
        <StatsCard
          title="Livreurs en ligne"
          value={`${stats.onlineDrivers} / ${stats.totalDrivers}`}
          icon={Truck}
          color="green"
        />
        <StatsCard
          title="Restaurants"
          value={stats.totalRestaurants}
          icon={UtensilsCrossed}
          color="purple"
        />
        <StatsCard
          title="Commissions restaurants (auj.)"
          value={fmt(stats.todayRestaurantCommissions)}
          subtitle="10% du sous-total"
          icon={CircleDollarSign}
          color="orange"
        />
        <StatsCard
          title="Commissions livreurs (auj.)"
          value={fmt(stats.todayDriverCommissions)}
          subtitle="23% des frais de livraison"
          icon={Users}
          color="orange"
        />
        <StatsCard
          title="Revenu total (auj.)"
          value={fmt(stats.todayTotal)}
          icon={TrendingUp}
          color="green"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">
          Revenus des 14 derniers jours
        </h3>
        <RevenueChart data={stats.chartData} />
      </div>
    </div>
  );
}
