export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import PageHeader from "@/components/PageHeader";
import RevenueChart from "@/components/RevenueChart";
import CategoryRevenueTable from "@/components/CategoryRevenueTable";
import {
  Truck,
  UtensilsCrossed,
  ShoppingBag,
  TrendingUp,
  CircleDollarSign,
  Users,
  LayoutDashboard,
} from "lucide-react";

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

async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ordersRes, driversRes, restaurantsRes, commissionsRes, revenueRes, vendorsRes] =
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
      // Last 30 days revenue by day. Also carries the columns the per-category
      // split needs, so the breakdown costs no extra round trip.
      supabaseAdmin
        .from("orders")
        .select(
          "platform_fee, driver_fee_cut, created_at, order_type, restaurant_id, supermarket_id, total"
        )
        .eq("status", "delivered")
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
        ),
      // id -> category for every vertical. `vendors` is the source of truth;
      // restaurant_id and supermarket_id both reference it.
      supabaseAdmin.from("vendors").select("id, category"),
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
  // ── Revenue per vertical ────────────────────────────────────────────────
  // An order's vertical is NOT order_type alone: every generic-category order
  // (flowers, pets, gifts, bakery, electronics) is stored as order_type
  // 'food', because orders_order_type_check has no per-category value. The
  // real vertical comes from the vendor it points at.
  const categoryOf = Object.fromEntries(
    (vendorsRes.data ?? []).map((v) => [v.id, v.category as string])
  );
  const CATEGORIES: { key: string; label: string }[] = [
    { key: "food", label: "Restaurants" },
    { key: "grocery", label: "Supermarchés" },
    { key: "bakery", label: "Pâtisserie" },
    { key: "flowers", label: "Fleurs" },
    { key: "pets", label: "Animalerie" },
    { key: "gifts", label: "Cadeaux" },
    { key: "electronics", label: "Électronique" },
    { key: "courier", label: "Colis" },
    { key: "facture", label: "Facture" },
    // Orders whose venue no longer resolves (both ids null, or a deleted
    // vendor). Shown rather than dropped so the totals still reconcile.
    { key: "autre", label: "Autre" },
  ];
  const bucketOf = (o: {
    order_type: string | null;
    restaurant_id: string | null;
    supermarket_id: string | null;
  }) => {
    if (o.order_type === "courier") return "courier";
    if (o.order_type === "facture" || o.order_type === "billPayment") return "facture";
    const venueId = o.restaurant_id ?? o.supermarket_id;
    return (venueId && categoryOf[venueId]) || "autre";
  };

  const tally: Record<string, { orders: number; revenue: number; gross: number }> = {};
  for (const c of CATEGORIES) tally[c.key] = { orders: 0, revenue: 0, gross: 0 };
  revenueData.forEach((o) => {
    const b = tally[bucketOf(o)] ?? tally["autre"];
    b.orders += 1;
    b.revenue += (Number(o.platform_fee) || 0) + (Number(o.driver_fee_cut) || 0);
    b.gross += Number(o.total) || 0;
  });
  const categoryRows = CATEGORIES
    // "Autre" is noise unless it actually holds something.
    .filter((c) => c.key !== "autre" || tally[c.key].orders > 0)
    .map((c) => ({ key: c.key, label: c.label, ...tally[c.key] }));

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
    categoryRows,
  };
}

export default async function DashboardPage() {
  const [stats, rates] = await Promise.all([getDashboardStats(), getCommissionRates()]);
  const fmt = (n: number) => `${n.toFixed(3)} TND`;
  const pct = (r: number) => `${(r * 100).toFixed(0)}%`;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={LayoutDashboard}
        title="Vue d'ensemble"
        subtitle={new Date().toLocaleDateString("fr-TN", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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
          subtitle={`${pct(rates.restaurantRate)} du sous-total`}
          icon={CircleDollarSign}
          color="orange"
        />
        <StatsCard
          title="Commissions livreurs (auj.)"
          value={fmt(stats.todayDriverCommissions)}
          subtitle={`${pct(rates.driverRate)} des frais de livraison`}
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

      <div
        className="rounded-xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
          Revenus par catégorie
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Commandes livrées sur les 30 derniers jours — commission plateforme
          (restaurant + livreur).
        </p>
        <CategoryRevenueTable rows={stats.categoryRows} />
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

