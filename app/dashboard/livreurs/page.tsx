export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import DriverRow from "@/components/DriverRow";
import StatsCard from "@/components/StatsCard";
import ExportButton from "@/components/ExportButton";
import { Truck, CircleDollarSign, ShieldX, Wifi } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import {
  dossierStatusLabel,
  isDossierComplete,
  missingPieces,
} from "@/lib/driver-verification";

async function getDrivers() {
  const { data: drivers } = await supabaseAdmin
    .from("drivers")
    .select("id, user_id, is_online, is_blocked, current_lat, current_lng, last_location_update");

  if (!drivers?.length) return [];

  const userIds = drivers.map((d) => d.user_id);

  const [profilesRes, walletsRes, deliveriesRes, identityRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds),
    supabaseAdmin
      .from("wallets")
      .select("user_id, balance, status")
      .in("user_id", userIds),
    // `driver_fee_cut` is stamped on each order by a database trigger at the
    // moment of delivery, using the commission rate live at that time. The
    // trigger is deliberately non-retroactive, so older orders carry the rate
    // they were charged under — which is why a driver's total commission does
    // not always equal today's rate applied to their collected fees.
    supabaseAdmin
      .from("orders")
      .select("driver_id, delivery_fee, driver_fee_cut")
      .eq("status", "delivered")
      .in(
        "driver_id",
        drivers.map((d) => d.id)
      ),
    // Dossier de verification. driver_identity est admin-only en RLS ; seul
    // ce dashboard le lit, et le CIN ne sort jamais d'ici.
    supabaseAdmin
      .from("driver_identity")
      .select(
        "driver_id, cin, contract_signed_at, contract_legalized_at, contract_scan_path, verified_at"
      )
      .in(
        "driver_id",
        drivers.map((d) => d.id)
      ),
  ]);

  // Repli quand les colonnes de dossier manquent encore en base (cas vecu :
  // 20261015090000 a rapporte Success sans les poser). Un select qui echoue
  // renvoie data = null, et chaque livreur paraitrait alors sans CIN -- y
  // compris ceux qui en ont un. On redemande le minimum qui existe a coup sur.
  // Type elargi : le repli ne ramene que driver_id et cin, les autres champs
  // sont alors absents -- ce que le reste du code traite deja comme « non
  // renseigne ».
  type IdentityRow = {
    driver_id: string;
    cin: string | null;
    contract_signed_at?: string | null;
    contract_legalized_at?: string | null;
    contract_scan_path?: string | null;
    verified_at?: string | null;
  };
  let identityRows: IdentityRow[] | null =
    identityRes.data as IdentityRow[] | null;
  let schemaIncomplete = false;
  if (identityRes.error) {
    schemaIncomplete = true;
    const fallback = await supabaseAdmin
      .from("driver_identity")
      .select("driver_id, cin")
      .in(
        "driver_id",
        drivers.map((d) => d.id)
      );
    identityRows = fallback.data as IdentityRow[] | null;
  }

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

  const identities = Object.fromEntries(
    (identityRows ?? []).map((i) => [i.driver_id, i])
  );

  return drivers.map((d) => {
    const ident = identities[d.id] ?? null;
    // Trois pieces : CIN, date de legalisation, scan du contrat. Le critere
    // est ecrit une seule fois (lib/driver-verification.ts) et dit la meme
    // chose que driver_is_verified() en base, qui est ce qui AUTORISE
    // reellement un livreur a travailler.
    const verified = isDossierComplete(ident);
    const missing = missingPieces(ident);

    return {
      ...d,
      profile: profiles[d.user_id] ?? null,
      wallet: wallets[d.user_id] ?? null,
      stats: deliveriesByDriver[d.id] ?? { count: 0, totalFees: 0, totalCuts: 0 },
      identity: ident,
      verified,
      missing,
      schemaIncomplete,
    };
  });
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

  // Combien de livreurs seraient bloques si on activait le durcissement
  // maintenant. C'est ce chiffre qui dit quand basculer
  // driver_verification_required a 'on' sans priver la plateforme de livreurs.
  const pendingVerification = drivers.filter((d) => !d.verified).length;

  // Export: one row per driver
  const exportColumns = [
    "Nom", "Téléphone", "Statut", "En ligne",
    "Vérification", "Livraisons", "Frais collectés (TND)", "Commission due (TND)", "Solde wallet (TND)",
  ];
  const exportRows = drivers.map((d) => [
    d.profile?.full_name ?? "—",
    d.profile?.phone ?? "—",
    d.is_blocked ? "Bloqué" : "Actif",
    d.is_online ? "En ligne" : "Hors ligne",
    dossierStatusLabel(d.identity),
    String(d.stats?.count ?? 0),
    (d.stats?.totalFees ?? 0).toFixed(3),
    (d.stats?.totalCuts ?? 0).toFixed(3),
    (d.wallet?.balance ?? 0).toFixed(3),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader icon={Truck} title={"Livreurs"} />
        <ExportButton
          filename="livreurs"
          title="Liste des livreurs"
          subtitle={`${drivers.length} livreurs — exporté le ${new Date().toLocaleDateString("fr-FR")}`}
          columns={exportColumns}
          rows={exportRows}
        />
      </div>

      {drivers.some((d) => d.schemaIncomplete) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">
            Base incomplète : les colonnes de dossier sont absentes
          </p>
          <p className="text-sm text-red-700 mt-1">
            Seul le CIN est lisible ; ni le contrat ni son scan ne peuvent être
            affichés ou enregistrés, et aucun livreur n&apos;apparaîtra comme
            vérifié. Lancez{" "}
            <code className="px-1 bg-red-100 rounded">
              20261015103000_driver_verification_repair.sql
            </code>
            , puis rechargez cette page.
          </p>
        </div>
      )}

      {pendingVerification > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">
            {pendingVerification} livreur{pendingVerification > 1 ? "s" : ""} sans
            dossier complet
          </p>
          <p className="text-sm text-amber-800 mt-1">
            Il leur manque le CIN, la date de légalisation ou le scan du
            contrat — les trois sont exigés. Tant que
            <code className="mx-1 px-1 bg-amber-100 rounded">
              driver_verification_required
            </code>
            vaut <b>off</b>, ils travaillent normalement. Complétez leurs
            dossiers avant de passer le réglage à <b>on</b>, sinon ils seront
            tous bloqués d&apos;un coup.
          </p>
        </div>
      )}

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
            Taux actuel : 23% des frais de livraison — les commandes passées gardent le taux en vigueur au moment de leur livraison.
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
                <th className="px-5 py-3 font-medium">Commission due</th>
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
