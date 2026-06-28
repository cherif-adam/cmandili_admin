export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import RestaurantRow from "@/components/RestaurantRow";
import { UtensilsCrossed, CircleDollarSign, TrendingUp } from "lucide-react";

async function getRestaurants() {
  // restaurants has no partner_id column — the link is partners.entity_id = restaurants.id (text)
  const { data: restaurants, error } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, is_ghost_restaurant")
    .order("name");

  if (error) {
    console.error("restaurants query error:", JSON.stringify(error, null, 2));
    return [];
  }
  if (!restaurants?.length) return [];

  const restaurantIds = restaurants.map((r) => r.id);

  // Fetch partners by entity_id (stored as text = restaurant uuid)
  const [{ data: partners }, { data: orders }] = await Promise.all([
    supabaseAdmin
      .from("partners")
      .select("id, user_id, commission_rate, is_blocked, entity_id")
      .in("entity_id", restaurantIds),
    supabaseAdmin
      .from("orders")
      .select("restaurant_id, subtotal, platform_fee")
      .neq("status", "cancelled"),
  ]);

  // Map partner by entity_id (the restaurant uuid)
  const partnerByRestaurantId: Record<string, { id: string; user_id: string; commission_rate: number | null; is_blocked: boolean }> =
    Object.fromEntries((partners ?? []).map((p) => [p.entity_id, { id: p.id, user_id: p.user_id, commission_rate: p.commission_rate, is_blocked: p.is_blocked ?? false }]));

  const ordersByRestaurant: Record<
    string,
    { count: number; totalRevenue: number; totalCommissions: number }
  > = {};
  for (const o of orders ?? []) {
    if (!o.restaurant_id) continue;
    if (!ordersByRestaurant[o.restaurant_id])
      ordersByRestaurant[o.restaurant_id] = { count: 0, totalRevenue: 0, totalCommissions: 0 };
    ordersByRestaurant[o.restaurant_id].count++;
    ordersByRestaurant[o.restaurant_id].totalRevenue += Number(o.subtotal) ?? 0;
    ordersByRestaurant[o.restaurant_id].totalCommissions += Number(o.platform_fee) ?? 0;
  }

  return restaurants.map((r) => ({
    ...r,
    is_ghost_restaurant: r.is_ghost_restaurant ?? false,
    partner: partnerByRestaurantId[r.id] ?? null,
    stats: ordersByRestaurant[r.id] ?? { count: 0, totalRevenue: 0, totalCommissions: 0 },
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
          title="Restaurants fantÃ´mes"
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
                <th className="px-5 py-3 font-medium">Commandes livrÃ©es</th>
                <th className="px-5 py-3 font-medium">Chiffre d&apos;affaires</th>
                <th className="px-5 py-3 font-medium">Commission plateforme</th>
                <th className="px-5 py-3 font-medium">Solde</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => (
                <RestaurantRow key={r.id} restaurant={{ ...r, wallet: null }} />
              ))}
              {!restaurants.length && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                    Aucun restaurant trouvÃ©
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

