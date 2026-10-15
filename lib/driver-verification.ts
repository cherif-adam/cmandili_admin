/**
 * Dossier de vérification d'un livreur — le critère, écrit une seule fois.
 *
 * Trois pièces, et les trois sont obligatoires :
 *
 *   1. cin                   — saisi en présentiel au recrutement
 *   2. contract_legalized_at — date de légalisation de signature à la baladiya
 *   3. contract_scan_path    — le document lui-même, bucket privé driver-contracts
 *
 * LA BASE FAIT FOI. Ce qui AUTORISE un livreur à travailler, c'est
 * public.driver_is_verified() (migration 20261015190000) : elle garde les
 * trois portes du dispatch — le waterfall, le broadcast et la policy
 * d'acceptation. Ce fichier ne décide rien ; il dit la même chose à
 * l'interface, pour que l'admin ne lise pas « Vérifié » sur un livreur que la
 * base refuse.
 *
 * Il existe pour qu'il n'y ait qu'UN endroit en TypeScript où le critère est
 * écrit. Il était recopié dans la route API et dans la page des livreurs :
 * ajouter la troisième pièce à l'un et pas à l'autre aurait donné un dashboard
 * qui se contredit lui-même. driver-verification.test.ts relit la migration et
 * vérifie que les deux versions parlent des mêmes colonnes.
 *
 * Le scan est déposé par l'ADMIN, pas par le livreur : lui remet le papier
 * signé et légalisé, l'équipe le scanne. C'est pourquoi le message d'erreur
 * côté livreur ne lui réclame pas de scan.
 */

/** Une pièce absente et une pièce vide se traitent pareil. Les champs sont
 *  optionnels : quand les colonnes de dossier manquent encore en base, le
 *  select de repli ne ramène que le CIN. */
export interface DriverDossier {
  cin?: string | null;
  contract_legalized_at?: string | null;
  contract_scan_path?: string | null;
}

/** Les libellés affichés, dans l'ordre où l'admin les remplit. */
export const PIECE_CIN = "CIN";
export const PIECE_CONTRACT = "contrat";
export const PIECE_SCAN = "scan";

function filled(v: string | null | undefined): boolean {
  return typeof v === "string" ? v.trim().length > 0 : false;
}

/**
 * Ce qui manque, dans l'ordre de saisie. Tableau vide = dossier complet.
 *
 * Même traitement de la chaîne vide que la base (`btrim(...) <> ''`) : une
 * colonne texte remplie d'espaces n'est pas une pièce.
 */
export function missingPieces(dossier: DriverDossier | null | undefined): string[] {
  const d = dossier ?? {};
  const missing: string[] = [];
  if (!filled(d.cin)) missing.push(PIECE_CIN);
  if (!filled(d.contract_legalized_at)) missing.push(PIECE_CONTRACT);
  if (!filled(d.contract_scan_path)) missing.push(PIECE_SCAN);
  return missing;
}

export function isDossierComplete(
  dossier: DriverDossier | null | undefined
): boolean {
  return missingPieces(dossier).length === 0;
}

/** « Vérifié » ou « En attente (CIN / scan manquants) ». */
export function dossierStatusLabel(
  dossier: DriverDossier | null | undefined
): string {
  const missing = missingPieces(dossier);
  if (!missing.length) return "Vérifié";
  return `En attente (${missing.join(" / ")} manquant${
    missing.length > 1 ? "s" : ""
  })`;
}

// ── Le fichier du scan ─────────────────────────────────────────────────────

/** Un contrat scanné, c'est deux pages. 10 Mo laissent de la marge à un
 *  scanner réglé trop fin ou à une photo de téléphone récent. */
export const MAX_SCAN_BYTES = 10 * 1024 * 1024;

/** Ce que le sélecteur de fichier propose. Même liste que le reniflage
 *  ci-dessous : annoncer un type qu'on refuserait ensuite ferait échouer le
 *  dépôt après l'attente du téléversement. */
export const SCAN_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export type ScanKind = "pdf" | "jpg" | "png" | "webp";

function startsWith(head: Uint8Array, sig: number[], offset = 0): boolean {
  if (head.length < offset + sig.length) return false;
  return sig.every((b, i) => head[offset + i] === b);
}

/**
 * Le type réel du fichier, lu dans ses octets.
 *
 * Pas le Content-Type annoncé par le navigateur, ni l'extension du nom :
 * les deux sont fournis par le client. Un fichier mal étiqueté serait accepté,
 * stocké sous une extension qui ne lui correspond pas, et ne s'ouvrirait plus
 * le jour du litige — c'est-à-dire précisément quand on en a besoin.
 *
 * Renvoie null pour tout ce qui n'est pas reconnu, HEIC compris : mieux vaut
 * refuser clairement au dépôt que stocker un document que personne ne pourra
 * ouvrir. Safari convertit d'ailleurs en JPEG à l'envoi depuis Photos.
 */
export function sniffScanType(head: Uint8Array): ScanKind | null {
  // %PDF
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }
  // RIFF....WEBP
  if (
    startsWith(head, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }
  return null;
}

/** Le message à montrer, ou null si la taille passe. */
export function scanSizeError(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Fichier vide.";
  }
  if (bytes > MAX_SCAN_BYTES) {
    const mo = (bytes / (1024 * 1024)).toFixed(1);
    return `Fichier trop lourd (${mo} Mo). Maximum ${MAX_SCAN_BYTES / (1024 * 1024)} Mo.`;
  }
  return null;
}

/**
 * `<driver_id>/<timestamp>.<ext>`
 *
 * L'horodatage n'est pas décoratif : un remplacement écrit un NOUVEAU chemin,
 * donc l'ancien fichier reste dans le bucket. Rien n'est jamais écrasé — le
 * contrat remplacé est précisément la pièce qu'un litige peut réclamer. C'est
 * aussi la leçon des preuves colis, où un chemin fixe rendait un second essai
 * impossible après une première tentative ratée.
 */
export function scanStoragePath(
  driverId: string,
  kind: ScanKind,
  now: number
): string {
  return `${driverId}/${now}.${kind}`;
}
