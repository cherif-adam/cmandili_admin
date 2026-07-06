export const dynamic = "force-dynamic";
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import LoyaltyPayoutRow from "@/components/LoyaltyPayoutRow";
import { Gift, Clock, CircleDollarSign, Scale } from "lucide-react";

async function getPayouts() {
  const { data: payouts } = await supabaseAdmin
    .from("loyalty_driver_payouts")
    .select("id, order_id, driver_id, milestone_type, amount_owed, status, created_at, settled_at")
    .order("created_at", { ascending: false });

  if (!payouts?.length) return [];

  const driverIds = [...new Set(payouts.map((p) => p.driver_id))];
  const { data: drivers } = await supabaseAdmin
    .from("drivers")
    .select("id, user_id")
    .in("id", driverIds);

  const userIds = (drivers ?? []).map((d) => d.user_id);
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", userIds);

  const profileByUserId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const driverById = Object.fromEntries(
    (drivers ?? []).map((d) => [d.id, profileByUserId[d.user_id] ?? null])
  );

  return payouts.map((p) => ({
    id: p.id,
    milestone_type: p.milestone_type as "half" | "free",
    amount_owed: Number(p.amount_owed),
    status: p.status as "pending" | "settled",
    created_at: p.created_at,
    settled_at: p.settled_at,
    driverName: driverById[p.driver_id]?.full_name ?? "—",
    driverPhone: driverById[p.driver_id]?.phone ?? null,
    orderShortId: (p.order_id as string).slice(0, 8).toUpperCase(),
  }));
}

// Per-driver: commission owed to Cmandili (existing mechanism, same query
// shape as /dashboard/livreurs) minus total loyalty payouts made to them.
async function getDriverNetSummary() {
  const { data: drivers } = await supabaseAdmin
    .from("drivers")
    .select("id, user_id");

  if (!drivers?.length) return [];

  const driverIds = drivers.map((d) => d.id);
  const userIds = drivers.map((d) => d.user_id);

  const [profilesRes, ordersRes, payoutsRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds),
    supabaseAdmin
      .from("orders")
      .select("driver_id, driver_fee_cut")
      .eq("status", "delivered")
      .in("driver_id", driverIds),
    supabaseAdmin
      .from("loyalty_driver_payouts")
      .select("driver_id, amount_owed, status")
      .in("driver_id", driverIds),
  ]);

  const profiles = Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p]));

  const commissionByDriver: Record<string, number> = {};
  for (const o of ordersRes.data ?? []) {
    if (!o.driver_id) continue;
    commissionByDriver[o.driver_id] = (commissionByDriver[o.driver_id] ?? 0) + (o.driver_fee_cut ?? 0);
  }

  const payoutsByDriver: Record<string, { pending: number; settled: number }> = {};
  for (const p of payoutsRes.data ?? []) {
    if (!payoutsByDriver[p.driver_id]) payoutsByDriver[p.driver_id] = { pending: 0, settled: 0 };
    payoutsByDriver[p.driver_id][p.status as "pending" | "settled"] += Number(p.amount_owed);
  }

  return drivers
    .map((d) => {
      const commissionOwed = commissionByDriver[d.id] ?? 0;
      const loyalty = payoutsByDriver[d.id] ?? { pending: 0, settled: 0 };
      const loyaltyTotal = loyalty.pending + loyalty.settled;
      return {
        id: d.id,
        name: profiles[d.user_id]?.full_name ?? "—",
        commissionOwed,
        loyaltyPending: loyalty.pending,
        loyaltySettled: loyalty.settled,
        net: commissionOwed - loyaltyTotal,
      };
    })
    .filter((d) => d.commissionOwed > 0 || d.loyaltyPending > 0 || d.loyaltySettled > 0);
}

export default async function FidelitePage() {
  const [payouts, driverSummary] = await Promise.all([getPayouts(), getDriverNetSummary()]);

  const pending = payouts.filter((p) => p.status === "pending");
  const settled = payouts.filter((p) => p.status === "settled");
  const totalPending = pending.reduce((s, p) => s + p.amount_owed, 0);
  const totalSettled = settled.reduce((s, p) => s + p.amount_owed, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Programme fidélité</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Paiements en attente" value={pending.length} icon={Clock} color="orange" />
        <StatsCard
          title="Montant en attente"
          value={`${totalPending.toFixed(3)} TND`}
          icon={CircleDollarSign}
          color="red"
        />
        <StatsCard title="Paiements réglés" value={settled.length} icon={Gift} color="green" />
        <StatsCard
          title="Montant réglé"
          value={`${totalSettled.toFixed(3)} TND`}
          icon={Scale}
          color="blue"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Paiements fidélité en attente</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Cmandili doit ces montants aux livreurs pour compenser les remises fidélité —
            à régler manuellement (espèces/virement) puis marquer comme réglé.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="px-5 py-3 font-medium">Livreur</th>
                <th className="px-5 py-3 font-medium">Commande</th>
                <th className="px-5 py-3 font-medium">Palier</th>
                <th className="px-5 py-3 font-medium">Montant dû</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <LoyaltyPayoutRow key={p.id} payout={p} />
              ))}
              {!payouts.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                    Aucun paiement fidélité pour le moment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Solde net par livreur</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Commission due à Cmandili (23% des frais de livraison) moins les paiements fidélité
            (en attente + réglés) versés à ce livreur.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="px-5 py-3 font-medium">Livreur</th>
                <th className="px-5 py-3 font-medium">Commission due</th>
                <th className="px-5 py-3 font-medium">Fidélité en attente</th>
                <th className="px-5 py-3 font-medium">Fidélité réglée</th>
                <th className="px-5 py-3 font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {driverSummary.map((d) => (
                <tr key={d.id} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                  <td className="px-5 py-4 text-white font-medium">{d.name}</td>
                  <td className="px-5 py-4 text-gray-300">{d.commissionOwed.toFixed(3)} TND</td>
                  <td className="px-5 py-4 text-orange-400">{d.loyaltyPending.toFixed(3)} TND</td>
                  <td className="px-5 py-4 text-gray-400">{d.loyaltySettled.toFixed(3)} TND</td>
                  <td className={`px-5 py-4 font-medium ${d.net < 0 ? "text-red-400" : "text-green-400"}`}>
                    {d.net.toFixed(3)} TND
                  </td>
                </tr>
              ))}
              {!driverSummary.length && (
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
