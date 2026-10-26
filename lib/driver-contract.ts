/**
 * Le contrat qui circule entre l'admin et le livreur (migration
 * 20261026120000_driver_contract_exchange.sql).
 *
 *   sent       l'admin a envoye le PDF, le livreur doit le signer
 *   submitted  le livreur a renvoye la photo du contrat signe et legalise
 *   approved   l'admin l'a validee : elle est devenue le scan du dossier
 *   rejected   l'admin l'a refusee (motif dans admin_note), a renvoyer
 *
 * Les fichiers vivent dans le bucket PRIVE driver-contracts :
 *   to_sign/<driver_id>/<ts>.pdf   envoye par l'admin
 *   signed/<driver_id>/<ts>.<ext>  renvoye par le livreur
 * Rien n'est ecrase : chaque envoi ecrit un nouveau chemin horodate.
 */

export type ContractStatus = "sent" | "submitted" | "approved" | "rejected";

export interface DriverContract {
  status: ContractStatus;
  to_sign_path: string | null;
  sent_at: string | null;
  signed_path: string | null;
  submitted_at: string | null;
  admin_note: string | null;
  reviewed_at: string | null;
}

export function contractToSignPath(driverId: string, now: number): string {
  return `to_sign/${driverId}/${now}.pdf`;
}

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  sent: "Envoyé — en attente de la signature du livreur",
  submitted: "Renvoyé signé par le livreur — à vérifier",
  approved: "Validé",
  rejected: "Refusé — le livreur doit le renvoyer",
};
