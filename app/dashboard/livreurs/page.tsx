export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import DriverRow from "@/components/DriverRow";
import StatsCard from "@/components/StatsCard";
import ExportButton from "@/components/ExportButton";
import { Truck, CircleDollarSign, ShieldX, Wifi } from "lucide-react";

async function getDrivers() {
  const { data: drivers } = await supabaseAdmin
    .from("drivers")
    .select("id, user_id, is_online, is_blocked, current_lat, current_lng, last_location_update");

  if (!drivers?.length) return [];

  const userIds = drivers.map((d) => d.user_id);

  const [profilesRes, walletsRes, deliveriesRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds),
    supabaseAdmin
      .from("wallets")
      .select("user_id, balance, status")
      .in("user_id", userIds),
    supabaseAdmin
      .from("orders")
      .select("driver_id, delivery_fee, driver_fee_cut")
      .eq("status", "delivered")
      .in(
        "driver_id",
        drivers.map((d) => d.id)
      ),
  ]);

  const profiles = Object.fromEntries(
    (profilesRes.data ?? []).map((p) => [p.id, p])
  );
  const wallets = Object.fromEntries(
    (walletsRes.data ?? []).map((w) => [w.user_id, w])
  );

  const deliveriesByDriver: Record<
    string,
    { count: number; totalFees: number; totalCuts: number }
  > = {};
  for (const o of deliveriesRes.data ?? []) {
    if (!o.driver_id) continue;
    if (!deliveriesByDriver[o.driver_id])
      deliveriesByDriver[o.driver_id] = { count: 0, totalFees: 0, totalCuts: 0 };
    deliveriesByDriver[o.driver_id].count++;
    deliveriesByDriver[o.driver_id].totalFees += o.delivery_fee ?? 0;
    deliveriesByDriver[o.driver_id].totalCuts += o.driver_fee_cut ?? 0;
  }

  return drivers.map((d) => ({
    ...d,
    profile: profiles[d.user_id] ?? null,
    wallet: wallets[d.user_id] ?? null,
    stats: deliveriesByDriver[d.id] ?? { count: 0, totalFees: 0, totalCuts: 0 },
  }));
}

export default async function LivreursPage() {
  const drivers = await getDrivers();

  const onlineCount = drivers.filter((d) => d.is_online).length;
  const blockedCount = drivers.filter((d) => d.is_blocked).length;
  const totalCommissions = drivers.reduce(
    (s, d) => s + (d.stats?.totalCuts ?? 0),
    0
  );
  const pendingCommissions = drivers
    .filter((d) => (d.wallet?.balance ?? 0) < 0)
    .reduce((s, d) => s + Math.abs(d.wallet?.balance ?? 0), 0);

  // Export: one row per driver
  const exportColumns = [
    "Nom", "Téléphone", "Statut", "En ligne",
    "Livraisons", "Frais collectés (TND)", "Commission due (TND)", "Solde wallet (TND)",
  ];
  const exportRows = drivers.map((d) => [
    d.profile?.full_name ?? "—",
    d.profile?.phone ?? "—",
    d.is_blocked ? "Bloqué" : "Actif",
    d.is_online ? "En ligne" : "Hors ligne",
    String(d.stats?.count ?? 0),
    (d.stats?.totalFees ?? 0).toFixed(3),
    (d.stats?.totalCuts ?? 0).toFixed(3),
    (d.wallet?.balance ?? 0).toFixed(3),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Livreurs</h2>
        <ExportButton
          filename="livreurs"
          title="Liste des livreurs"
          subtitle={`${drivers.length} livreurs — exporté le ${new Date().toLocaleDateString("fr-FR")}`}
          columns={exportColumns}
          rows={exportRows}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total livreurs"
          value={drivers.length}
          icon={Truck}
          color="blue"
        />
        <StatsCard
          title="En ligne"
          value={onlineCount}
          icon={Wifi}
          color="green"
        />
        <StatsCard
          title="Comptes bloqués"
          value={blockedCount}
          icon={ShieldX}
          color="red"
        />
        <StatsCard
          title="Commissions dues"
          value={`${pendingCommissions.toFixed(3)} TND`}
          subtitle="Soldes négatifs"
          icon={CircleDollarSign}
          color="orange"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Liste des livreurs</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Commission plateforme : 23% des frais de livraison
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="px-5 py-3 font-medium">Livreur</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Livraisons</th>
                <th className="px-5 py-3 font-medium">Frais collectés</th>
                <th className="px-5 py-3 font-medium">Commission due (23%)</th>
                <th className="px-5 py-3 font-medium">Solde wallet</th>
                <th className="px-5 py-3 font-medium">Compte</th>
                <th className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <DriverRow key={driver.id} driver={driver} />
              ))}
              {!drivers.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-8 text-center text-gray-500"
                  >
                    Aucun livreur trouvé
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
