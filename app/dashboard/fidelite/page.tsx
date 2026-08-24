export const dynamic = "force-dynamic";
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import { Gift, Users, CircleDollarSign, Target } from "lucide-react";

// settlements.user_id is the driver's auth user_id directly (generate_settlements_
// on_delivery() resolves it from drivers.user_id before inserting) — no drivers
// join needed, profiles.id matches it directly.
async function getSubsidySettlements() {
  const { data: settlements } = await supabaseAdmin
    .from("settlements")
    .select("id, user_id, amount, related_order_id, created_at")
    .eq("type", "loyalty_subsidy")
    .order("created_at", { ascending: false });

  if (!settlements?.length) return [];

  const orderIds = [...new Set(settlements.map((s) => s.related_order_id).filter(Boolean))];
  const { data: orders } = orderIds.length
    ? await supabaseAdmin.from("orders").select("id, loyalty_milestone_type").in("id", orderIds)
    : { data: [] };
  const milestoneByOrder = Object.fromEntries((orders ?? []).map((o) => [o.id, o.loyalty_milestone_type]));

  const userIds = [...new Set(settlements.map((s) => s.user_id))];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", userIds);
  const profileByUserId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return settlements.map((s) => ({
    id: s.id,
    driverName: profileByUserId[s.user_id]?.full_name ?? "—",
    driverPhone: profileByUserId[s.user_id]?.phone ?? null,
    amount: Number(s.amount),
    milestoneType: (s.related_order_id ? milestoneByOrder[s.related_order_id] : null) as "half" | "free" | null,
    orderShortId: s.related_order_id ? String(s.related_order_id).slice(0, 8).toUpperCase() : "—",
    createdAt: s.created_at as string,
  }));
}

async function getCustomerProgress() {
  const { data: progress } = await supabaseAdmin
    .from("loyalty_customer_progress")
    .select("customer_id, delivered_count, updated_at")
    .order("delivered_count", { ascending: false });

  if (!progress?.length) return [];

  const userIds = progress.map((p) => p.customer_id);
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", userIds);
  const profileByUserId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return progress.map((p) => {
    const count = p.delivered_count;
    // Orders remaining until the next multiple of 5 (every 5th = half-off,
    // every 10th = free — mirrors apply_loyalty_at_checkout()'s own math).
    const ordersUntilNext = 5 - (count % 5 === 0 ? 5 : count % 5);
    const nextCount = count + ordersUntilNext;
    const nextMilestone: "half" | "free" = nextCount % 10 === 0 ? "free" : "half";
    return {
      customerId: p.customer_id as string,
      name: profileByUserId[p.customer_id]?.full_name ?? "—",
      phone: profileByUserId[p.customer_id]?.phone ?? null,
      deliveredCount: count as number,
      ordersUntilNext,
      nextMilestone,
      updatedAt: p.updated_at as string,
    };
  });
}

const milestoneLabel: Record<"half" | "free", string> = {
  half: "-50% livraison",
  free: "Livraison gratuite",
};

export default async function FidelitePage() {
  const [subsidies, progress] = await Promise.all([getSubsidySettlements(), getCustomerProgress()]);

  const totalSubsidyAmount = subsidies.reduce((s, p) => s + p.amount, 0);
  const closeToMilestone = progress.filter((p) => p.ordersUntilNext <= 2).length;

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Programme fidélité</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Subventions versées" value={subsidies.length} icon={Gift} color="green" />
        <StatsCard
          title="Montant total versé"
          value={`${totalSubsidyAmount.toFixed(3)} TND`}
          icon={CircleDollarSign}
          color="blue"
        />
        <StatsCard title="Clients participants" value={progress.length} icon={Users} color="purple" />
        <StatsCard
          title="Proches d'un palier (≤2 commandes)"
          value={closeToMilestone}
          icon={Target}
          color="orange"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Subventions fidélité versées aux livreurs</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Créditées automatiquement sur le wallet du livreur à la livraison — aucune action requise
            (le livreur touche le même net que pour une commande à prix plein).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="px-5 py-3 font-medium">Livreur</th>
                <th className="px-5 py-3 font-medium">Commande</th>
                <th className="px-5 py-3 font-medium">Palier</th>
                <th className="px-5 py-3 font-medium">Montant</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {subsidies.map((s) => (
                <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                  <td className="px-5 py-4 text-white font-medium">
                    {s.driverName}
                    {s.driverPhone && <p className="text-xs text-gray-500">{s.driverPhone}</p>}
                  </td>
                  <td className="px-5 py-4 text-gray-300 font-mono text-xs">{s.orderShortId}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        s.milestoneType === "free"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-orange-500/15 text-orange-400"
                      }`}
                    >
                      {s.milestoneType ? milestoneLabel[s.milestoneType] : "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-green-400 font-medium">+{s.amount.toFixed(3)} TND</td>
                  <td className="px-5 py-4 text-gray-400">{fmtDate(s.createdAt)}</td>
                </tr>
              ))}
              {!subsidies.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                    Aucune subvention fidélité pour le moment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Progression fidélité par client</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Compteur à vie des commandes livrées — palier -50% tous les 5, gratuit tous les 10.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Commandes livrées</th>
                <th className="px-5 py-3 font-medium">Prochain palier</th>
                <th className="px-5 py-3 font-medium">Commandes restantes</th>
                <th className="px-5 py-3 font-medium">Dernière mise à jour</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((p) => (
                <tr key={p.customerId} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                  <td className="px-5 py-4 text-white font-medium">
                    {p.name}
                    {p.phone && <p className="text-xs text-gray-500">{p.phone}</p>}
                  </td>
                  <td className="px-5 py-4 text-gray-300">{p.deliveredCount}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        p.nextMilestone === "free"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-orange-500/15 text-orange-400"
                      }`}
                    >
                      {milestoneLabel[p.nextMilestone]}
                    </span>
                  </td>
                  <td className={`px-5 py-4 font-medium ${p.ordersUntilNext <= 2 ? "text-orange-400" : "text-gray-400"}`}>
                    {p.ordersUntilNext}
                  </td>
                  <td className="px-5 py-4 text-gray-400">{fmtDate(p.updatedAt)}</td>
                </tr>
              ))}
              {!progress.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                    Aucune donnée
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
