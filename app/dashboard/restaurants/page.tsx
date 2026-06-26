import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import RestaurantRow from "@/components/RestaurantRow";
import { UtensilsCrossed, CircleDollarSign, TrendingUp } from "lucide-react";

async function getRestaurants() {
  const { data: restaurants, error } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, is_ghost_restaurant")
    .order("name");

  if (error) {
    console.error("restaurants query error:", error);
    return [];
  }
  if (!restaurants?.length) return [];

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("restaurant_id, subtotal, platform_fee")
    .neq("status", "cancelled");

  const ordersByRestaurant: Record<
    string,
    { count: number; totalRevenue: number; totalCommissions: number }
  > = {};
  for (const o of orders ?? []) {
    if (!o.restaurant_id) continue;
    if (!ordersByRestaurant[o.restaurant_id])
      ordersByRestaurant[o.restaurant_id] = {
        count: 0,
        totalRevenue: 0,
        totalCommissions: 0,
      };
    ordersByRestaurant[o.restaurant_id].count++;
    ordersByRestaurant[o.restaurant_id].totalRevenue += Number(o.subtotal) ?? 0;
    ordersByRestaurant[o.restaurant_id].totalCommissions += Number(o.platform_fee) ?? 0;
  }

  return restaurants.map((r) => ({
    ...r,
    is_ghost_restaurant: r.is_ghost_restaurant ?? false,
    stats: ordersByRestaurant[r.id] ?? {
      count: 0,
      totalRevenue: 0,
      totalCommissions: 0,
    },
  }));
}

export default async function RestaurantsPage() {
  const restaurants = await getRestaurants();

  const totalRevenue = restaurants.reduce((s, r) => s + r.stats.totalRevenue, 0);
  const totalCommissions = restaurants.reduce((s, r) => s + r.stats.totalCommissions, 0);
  const ghostCount = restaurants.filter((r) => r.is_ghost_restaurant).length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Restaurants & Partenaires</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total restaurants"
          value={restaurants.length}
          icon={UtensilsCrossed}
          color="purple"
        />
        <StatsCard
          title="Restaurants fantômes"
          value={ghostCount}
          icon={UtensilsCrossed}
          color="blue"
        />
        <StatsCard
          title="Chiffre d'affaires total"
          value={`${totalRevenue.toFixed(3)} TND`}
          icon={TrendingUp}
          color="blue"
        />
        <StatsCard
          title="Commissions plateforme"
          value={`${totalCommissions.toFixed(3)} TND`}
          icon={CircleDollarSign}
          color="orange"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Liste des restaurants</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="px-5 py-3 font-medium">Restaurant</th>
                <th className="px-5 py-3 font-medium">Commandes livrées</th>
                <th className="px-5 py-3 font-medium">Chiffre d&apos;affaires</th>
                <th className="px-5 py-3 font-medium">Commission plateforme</th>
                <th className="px-5 py-3 font-medium">Solde</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => (
                <RestaurantRow key={r.id} restaurant={{ ...r, partner: null, wallet: null }} />
              ))}
              {!restaurants.length && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                    Aucun restaurant trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
