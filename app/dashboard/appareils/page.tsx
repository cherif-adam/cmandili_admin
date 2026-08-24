export const dynamic = "force-dynamic";
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import ExportButton from "@/components/ExportButton";
import { BellOff, Truck, UtensilsCrossed, Smartphone } from "lucide-react";

type AccountType = "driver" | "restaurant" | "supermarket";

interface AccountRow {
  key: string;
  type: AccountType;
  name: string;
  phone: string | null;
  tokenCount: number;
  lastRegisteredAt: string | null;
}

const typeLabel: Record<AccountType, string> = {
  driver: "Livreur",
  restaurant: "Restaurant",
  supermarket: "Supermarché",
};

async function getAccounts(): Promise<AccountRow[]> {
  const [{ data: drivers }, { data: partners }, { data: tokens }] = await Promise.all([
    supabaseAdmin.from("drivers").select("id, user_id"),
    supabaseAdmin.from("partners").select("id, user_id, partner_type, business_name, phone"),
    supabaseAdmin.from("device_tokens").select("user_id, updated_at"),
  ]);

  const userIds = [
    ...(drivers ?? []).map((d) => d.user_id),
    ...(partners ?? []).map((p) => p.user_id),
  ];
  const { data: profiles } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", userIds)
    : { data: [] };
  const profileByUserId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  // Per-user token count + most recent registration, from a single pass over
  // device_tokens (one user can have multiple rows — one per device/platform).
  const tokensByUser: Record<string, { count: number; lastAt: string | null }> = {};
  for (const t of tokens ?? []) {
    const entry = tokensByUser[t.user_id] ?? { count: 0, lastAt: null };
    entry.count++;
    if (!entry.lastAt || t.updated_at > entry.lastAt) entry.lastAt = t.updated_at;
    tokensByUser[t.user_id] = entry;
  }

  const driverRows: AccountRow[] = (drivers ?? []).map((d) => ({
    key: `driver-${d.id}`,
    type: "driver",
    name: profileByUserId[d.user_id]?.full_name ?? "—",
    phone: profileByUserId[d.user_id]?.phone ?? null,
    tokenCount: tokensByUser[d.user_id]?.count ?? 0,
    lastRegisteredAt: tokensByUser[d.user_id]?.lastAt ?? null,
  }));

  const partnerRows: AccountRow[] = (partners ?? []).map((p) => ({
    key: `partner-${p.id}`,
    type: p.partner_type === "supermarket" ? "supermarket" : "restaurant",
    name: p.business_name || profileByUserId[p.user_id]?.full_name || "—",
    phone: p.phone || profileByUserId[p.user_id]?.phone || null,
    tokenCount: tokensByUser[p.user_id]?.count ?? 0,
    lastRegisteredAt: tokensByUser[p.user_id]?.lastAt ?? null,
  }));

  // Zero-token accounts surface first — that's the actionable list.
  return [...driverRows, ...partnerRows].sort((a, b) => a.tokenCount - b.tokenCount);
}

export default async function AppareilsPage() {
  const accounts = await getAccounts();
  const zeroToken = accounts.filter((a) => a.tokenCount === 0);
  const driversZero = zeroToken.filter((a) => a.type === "driver").length;
  const partnersZero = zeroToken.filter((a) => a.type !== "driver").length;

  const exportColumns = ["Nom", "Type", "Téléphone", "Tokens enregistrés", "Dernier enregistrement"];
  const exportRows = accounts.map((a) => [
    a.name,
    typeLabel[a.type],
    a.phone ?? "—",
    String(a.tokenCount),
    a.lastRegisteredAt ? new Date(a.lastRegisteredAt).toLocaleString("fr-FR") : "—",
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">État des notifications (FCM)</h2>
        <ExportButton
          filename="appareils"
          title="État des notifications"
          columns={exportColumns}
          rows={exportRows}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Comptes sans notification" value={zeroToken.length} icon={BellOff} color="red" />
        <StatsCard title="Livreurs concernés" value={driversZero} icon={Truck} color="orange" />
        <StatsCard title="Partenaires concernés" value={partnersZero} icon={UtensilsCrossed} color="orange" />
        <StatsCard title="Total comptes suivis" value={accounts.length} icon={Smartphone} color="blue" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Livreurs & partenaires</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Un compte à 0 token n&apos;a jamais enregistré d&apos;appareil pour les notifications push —
            il ne recevra ni les alertes de nouvelle commande, ni les mises à jour de statut.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="px-5 py-3 font-medium">Nom</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Téléphone</th>
                <th className="px-5 py-3 font-medium">Tokens enregistrés</th>
                <th className="px-5 py-3 font-medium">Dernier enregistrement</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr
                  key={a.key}
                  className={`border-b border-gray-800 hover:bg-gray-800/40 transition-colors ${
                    a.tokenCount === 0 ? "bg-red-500/5" : ""
                  }`}
                >
                  <td className="px-5 py-4 text-white font-medium">{a.name}</td>
                  <td className="px-5 py-4 text-gray-300">{typeLabel[a.type]}</td>
                  <td className="px-5 py-4 text-gray-400">{a.phone ?? "—"}</td>
                  <td className="px-5 py-4">
                    {a.tokenCount === 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-500/15 text-red-400 font-medium">
                        0 — aucun
                      </span>
                    ) : (
                      <span className="text-gray-300">{a.tokenCount}</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-gray-400">
                    {a.lastRegisteredAt ? new Date(a.lastRegisteredAt).toLocaleString("fr-FR") : "—"}
                  </td>
                </tr>
              ))}
              {!accounts.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                    Aucun compte trouvé
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
