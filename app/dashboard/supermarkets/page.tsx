import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import SupermarketRow from "@/components/SupermarketRow";
import { ShoppingCart, TrendingUp, Ghost } from "lucide-react";

async function getSupermarkets() {
  const { data: supermarkets, error } = await supabaseAdmin
    .from("supermarkets")
    .select("id, name, is_ghost_restaurant")
    .order("name");

  if (error) {
    console.error("supermarkets query error:", error);
    return [];
  }
  if (!supermarkets?.length) return [];

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("supermarket_id, subtotal")
    .neq("status", "cancelled");

  const ordersBySupermarket: Record<string, { count: number; totalRevenue: number }> = {};
  for (const o of orders ?? []) {
    if (!o.supermarket_id) continue;
    if (!ordersBySupermarket[o.supermarket_id])
      ordersBySupermarket[o.supermarket_id] = { count: 0, totalRevenue: 0 };
    ordersBySupermarket[o.supermarket_id].count++;
    ordersBySupermarket[o.supermarket_id].totalRevenue += Number(o.subtotal) ?? 0;
  }

  return supermarkets.map((s) => ({
    ...s,
    is_ghost_restaurant: s.is_ghost_restaurant ?? true,
    stats: ordersBySupermarket[s.id] ?? { count: 0, totalRevenue: 0 },
  }));
}

export default async function SupermarketsPage() {
  const supermarkets = await getSupermarkets();

  const totalRevenue = supermarkets.reduce((sum, s) => sum + s.stats.totalRevenue, 0);
  const ghostCount = supermarkets.filter((s) => s.is_ghost_restaurant).length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Supermarchés</h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Total supermarchés"
          value={supermarkets.length}
          icon={ShoppingCart}
          color="purple"
        />
        <StatsCard
          title="Supermarchés fantômes"
          value={ghostCount}
          icon={Ghost}
          color="blue"
        />
        <StatsCard
          title="Chiffre d'affaires total"
          value={`${totalRevenue.toFixed(3)} TND`}
          icon={TrendingUp}
          color="orange"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Liste des supermarchés</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="px-5 py-3 font-medium">Supermarché</th>
                <th className="px-5 py-3 font-medium">Commandes livrées</th>
                <th className="px-5 py-3 font-medium">Chiffre d&apos;affaires</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {supermarkets.map((s) => (
                <SupermarketRow key={s.id} supermarket={s} />
              ))}
              {!supermarkets.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                    Aucun supermarché trouvé
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
