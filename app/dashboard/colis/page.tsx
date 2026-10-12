export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import PageHeader from "@/components/PageHeader";
import ColisReceiptsTable from "@/components/ColisReceiptsTable";
import { PackageCheck } from "lucide-react";

/**
 * Bons de prise en charge Colis.
 *
 * Tout ce qu'un admin doit avoir sous les yeux pour trancher un litige :
 * les deux photos, les heures serveur, les positions, la distance à
 * l'adresse, le code vérifié ou non, le CIN et la plaque du livreur, et le
 * nombre de litiges déjà ouverts de chaque côté.
 *
 * Les URL de photos sont SIGNÉES ici, côté serveur : le bucket colis-proofs
 * est privé et le restera. Une URL signée vaut une heure, ce qui couvre
 * largement la durée d'un examen.
 */

const SIGNED_URL_TTL = 3600;

async function getReceipts() {
  const { data: receipts } = await supabaseAdmin
    .from("colis_receipts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!receipts?.length) return [];

  const orderIds = receipts.map((r) => r.order_id);

  // Le CIN vit dans une table séparée à RLS admin-only : il n'est jamais
  // joignable depuis une ligne que l'expéditeur ou le livreur peut lire.
  const { data: identities } = await supabaseAdmin
    .from("colis_receipt_identity")
    .select("order_id, driver_cin")
    .in("order_id", orderIds);
  const cinOf = Object.fromEntries(
    (identities ?? []).map((i) => [i.order_id, i.driver_cin as string | null])
  );

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, status, user_id, driver_id, delivered_at, created_at")
    .in("id", orderIds);
  const orderOf = Object.fromEntries((orders ?? []).map((o) => [o.id, o]));

  // Compteurs de litiges, par client et par livreur. Un seul passage sur la
  // table : la volumétrie ne justifie pas une vue agrégée.
  const { data: disputes } = await supabaseAdmin
    .from("colis_disputes")
    .select("order_id, user_id, driver_id, kind, created_at");
  const byUser: Record<string, number> = {};
  const byDriver: Record<string, number> = {};
  const byOrder: Record<string, number> = {};
  for (const d of disputes ?? []) {
    if (d.user_id) byUser[d.user_id] = (byUser[d.user_id] ?? 0) + 1;
    if (d.driver_id) byDriver[d.driver_id] = (byDriver[d.driver_id] ?? 0) + 1;
    if (d.order_id) byOrder[d.order_id] = (byOrder[d.order_id] ?? 0) + 1;
  }

  return Promise.all(
    receipts.map(async (r) => {
      const order = orderOf[r.order_id];
      const sign = async (path: string | null) => {
        if (!path) return null;
        const { data } = await supabaseAdmin.storage
          .from("colis-proofs")
          .createSignedUrl(path, SIGNED_URL_TTL);
        return data?.signedUrl ?? null;
      };

      return {
        ...r,
        driver_cin: cinOf[r.order_id] ?? null,
        order_status: order?.status ?? null,
        delivered_at: order?.delivered_at ?? null,
        pickup_url: await sign(r.pickup_photo_path),
        delivery_url: await sign(r.delivery_photo_path),
        disputes_on_order: byOrder[r.order_id] ?? 0,
        disputes_by_customer: order?.user_id ? byUser[order.user_id] ?? 0 : 0,
        disputes_by_driver: r.driver_id ? byDriver[r.driver_id] ?? 0 : 0,
      };
    })
  );
}

export default async function ColisPage() {
  const receipts = await getReceipts();

  // Un livreur bloqué par cinq codes erronés attend qu'un admin tranche, et
  // n'est pas payé tant que rien n'est fait. C'est l'alerte la plus urgente
  // de cette page, donc elle passe devant.
  const blocked = receipts.filter((r) => r.code_locked_at !== null);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Bons de prise en charge"
        subtitle="Preuves de remise des colis, litiges et clôtures forcées"
        icon={PackageCheck}
      />

      {blocked.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">
            {blocked.length} livraison{blocked.length > 1 ? "s" : ""} bloquée
            {blocked.length > 1 ? "s" : ""} par un code erroné
          </p>
          <p className="text-sm text-red-700 mt-1">
            Le livreur a épuisé ses cinq essais. Tant que vous ne clôturez pas,
            la commande n&apos;est pas livrée et le règlement ne part pas.
          </p>
        </div>
      )}

      <ColisReceiptsTable receipts={receipts} />
    </div>
  );
}
