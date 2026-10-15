export const dynamic = 'force-dynamic'
import PageHeader from "@/components/PageHeader";
import ColisReceiptsTable from "@/components/ColisReceiptsTable";
import { fetchColisReceipts } from "@/lib/colis-receipts-query";
import { PackageCheck } from "lucide-react";

/**
 * Bons de prise en charge Colis.
 *
 * Tout ce qu'un admin doit avoir sous les yeux pour trancher un litige :
 * les deux photos, les heures serveur, les positions, la distance à
 * l'adresse, le code vérifié ou non, la plaque du livreur, et le nombre de
 * litiges déjà ouverts de chaque côté.
 *
 * La lecture est déléguée à lib/colis-receipts-query.ts, que la route
 * /api/colis/search rappelle avec des filtres : un seul chemin de données
 * pour la vue par défaut et pour la recherche, donc aucune chance que celle
 * qu'on utilise sous pression se mette à mentir.
 *
 * Les URL de photos sont SIGNÉES côté serveur, à la volée : le bucket
 * colis-proofs est privé et le restera.
 *
 * LE CIN NE DESCEND PAS AVEC LA LISTE. Il se demande bon par bon
 * (/api/colis/cin, journalisé) ou s'obtient dans le PDF.
 */

export default async function ColisPage() {
  const initial = await fetchColisReceipts();

  // Un livreur bloqué par cinq codes erronés attend qu'un admin tranche, et
  // n'est pas payé tant que rien n'est fait. C'est l'alerte la plus urgente
  // de cette page, donc elle passe devant — et elle porte sur TOUS les bons,
  // pas sur le résultat d'une recherche en cours.
  const blocked = initial.rows.filter((r) => r.code_locked_at !== null);

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

      <ColisReceiptsTable initial={initial} />
    </div>
  );
}
