/**
 * Recherche dans les bons de prise en charge Colis — logique pure.
 *
 * Ce fichier ne lit rien, n'écrit rien et n'importe aucun client Supabase :
 * il reçoit des lignes déjà constituées et dit lesquelles correspondent. Deux
 * raisons :
 *
 *   1. il est testable sans base ni réseau (`node --test "lib/**\/*.test.ts"`),
 *      et la normalisation des numéros est précisément ce qu'il faut tester —
 *      un faux négatif ici, c'est un colis introuvable quand la police le
 *      demande ;
 *   2. il n'a aucune dépendance serveur, donc le composant client peut en
 *      importer les types sans tirer la clé service_role dans le bundle.
 *
 * LE CIN N'EST PAS CHERCHABLE ET N'APPARAÎT PAS DANS LA LISTE. Il ne voyage
 * jamais en lot : l'admin qui en a besoin ouvre un bon précis (route dédiée,
 * journalisée) ou télécharge le PDF. Un champ de recherche qui accepterait un
 * numéro de CIN en ferait, de fait, un index de pièces d'identité.
 */

/** Nombre de chiffres minimum avant de tenter une correspondance téléphone.
 *  En dessous, « 9 » ou « 94 » ramènerait la moitié de la base : ce n'est pas
 *  une recherche, c'est du bruit. */
export const MIN_PHONE_DIGITS = 3;

/** Longueur minimum d'un identifiant de commande. L'identifiant court affiché
 *  dans la liste fait 8 caractères ; 4 suffisent à viser, 3 ne visent rien. */
export const MIN_ID_CHARS = 4;

/** La Tunisie est à UTC+1 toute l'année — pas d'heure d'été depuis 2009.
 *  C'est ce qui permet de convertir une date de calendrier en instant sans
 *  bibliothèque de fuseaux, et c'est le même fuseau que l'affichage
 *  (`toLocaleString(..., { timeZone: "Africa/Tunis" })`). */
export const TUNIS_UTC_OFFSET = "+01:00";

/** Les champs sur lesquels la recherche porte. Volontairement étroit : ce qui
 *  n'est pas là n'est pas cherchable, CIN compris. */
export interface ColisSearchable {
  order_id: string;
  sender_name: string | null;
  sender_phone: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  /** Cherchable parce que c'est le seul texte visible sur la ligne repliée :
   *  taper un mot qu'on a sous les yeux doit ramener la ligne. */
  description: string | null;
}

/** Une ligne de la liste, telle qu'elle part au navigateur. Pas de CIN. */
export interface ColisReceiptListRow extends ColisSearchable {
  driver_id: string | null;
  driver_plate: string | null;
  /** true quand le nom affiché n'a PAS été figé à la prise en charge et vient
   *  des données courantes. L'interface le signale : un nom courant n'atteste
   *  pas qui a pris le colis en charge ce jour-là. Même convention que
   *  l'export PDF (`CURRENT_SUFFIX`). */
  sender_name_is_current: boolean;
  driver_name_is_current: boolean;
  declared_value: number | null;
  delivery_mode: string;
  receiver_label: string | null;
  no_code_accepted_at: string | null;
  code_attempts: number;
  code_locked_at: string | null;
  pickup_at: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_url: string | null;
  delivery_at: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_distance_m: number | null;
  delivery_url: string | null;
  code_verified: boolean | null;
  admin_override_reason: string | null;
  admin_override_at: string | null;
  proof_status: string;
  order_status: string | null;
  delivered_at: string | null;
  created_at: string | null;
  disputes_on_order: number;
  disputes_by_customer: number;
  disputes_by_driver: number;
}

export interface ColisSearchFilters {
  /** Texte libre : téléphone, identifiant de commande, nom, mot du contenu. */
  q?: string | null;
  /** Date de calendrier `YYYY-MM-DD`, heure de Tunis, bornes incluses. */
  from?: string | null;
  to?: string | null;
}

export interface ColisSearchResult {
  rows: ColisReceiptListRow[];
  /** Nombre de bons correspondants, avant la coupe d'affichage. */
  matched: number;
  /** true quand la fenêtre d'examen du serveur a été atteinte : des bons plus
   *  anciens n'ont PAS été examinés. L'interface doit le dire — une recherche
   *  tronquée en silence sur une réquisition, c'est un bon déclaré
   *  introuvable alors qu'il existe. */
  truncated: boolean;
}

/** Tous les chiffres, rien d'autre. */
export function phoneDigits(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).replace(/\D/g, "");
}

/**
 * Ramène un numéro tunisien à ses 8 chiffres locaux.
 *
 *   « 94 240 607 »    -> « 94240607 »
 *   « +216 94240607 » -> « 94240607 »
 *   « 0021694240607 » -> « 94240607 »
 *
 * Les préfixes ne sont retirés QUE s'il reste au moins 8 chiffres derrière.
 * Sans ce garde-fou, le numéro local « 21612345 » — 8 chiffres qui commencent
 * par 216 — serait amputé en « 12345 » et deviendrait introuvable. C'est
 * pourquoi `normalizeForWhatsApp` (components/ContactActions.tsx) n'est pas
 * réutilisée ici : elle tronque sans compter, ce qui convient pour composer un
 * lien wa.me mais pas pour comparer deux numéros.
 */
export function normalisePhone(raw: string | null | undefined): string {
  const d = phoneDigits(raw);
  if (d.startsWith("00216") && d.length >= 13) return d.slice(5);
  if (d.startsWith("216") && d.length >= 11) return d.slice(3);
  if (d.startsWith("0") && d.length >= 9) return d.slice(1);
  return d;
}

/**
 * Le numéro cherché apparaît-il dans le numéro enregistré ?
 *
 * Sous-chaîne et non égalité : l'admin tape souvent les derniers chiffres,
 * ceux que le client lui a lus au téléphone.
 */
export function phoneMatches(
  needle: string,
  candidate: string | null | undefined
): boolean {
  const n = normalisePhone(needle);
  if (n.length < MIN_PHONE_DIGITS) return false;
  const c = normalisePhone(candidate);
  if (!c) return false;
  return c.includes(n);
}

/** Minuscules, accents retirés, espaces normalisés : « Chérif » == « cherif ». */
export function foldText(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function textMatches(
  needle: string,
  candidate: string | null | undefined
): boolean {
  const n = foldText(needle);
  if (!n) return false;
  const c = foldText(candidate);
  if (!c) return false;
  return c.includes(n);
}

/** Ne garde que les caractères hexadécimaux : retire le « # » de l'affichage
 *  et les tirets d'un UUID collé. */
function foldHex(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).toLowerCase().replace(/[^0-9a-f]/g, "");
}

/**
 * Identifiant de commande, court ou complet.
 *
 * Préfixe, parce que c'est ce que « #A1B2C3D4 » veut dire : les 8 premiers
 * caractères de l'UUID, tels que la liste les affiche.
 */
export function orderIdMatches(
  needle: string,
  orderId: string | null | undefined
): boolean {
  const n = foldHex(needle);
  if (n.length < MIN_ID_CHARS) return false;
  const id = foldHex(orderId);
  if (!id) return false;
  return id.startsWith(n);
}

/** Découpe la requête en mots. */
export function tokenise(query: string | null | undefined): string[] {
  if (!query) return [];
  return String(query)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Un mot correspond-il à cette ligne ?
 *
 * OU entre les champs : un mot peut être un téléphone, un identifiant, un nom
 * ou un mot du contenu, et l'admin ne précise pas lequel.
 */
export function rowMatchesToken(row: ColisSearchable, token: string): boolean {
  if (
    phoneMatches(token, row.sender_phone) ||
    phoneMatches(token, row.recipient_phone) ||
    phoneMatches(token, row.driver_phone)
  ) {
    return true;
  }
  if (orderIdMatches(token, row.order_id)) return true;
  return (
    textMatches(token, row.sender_name) ||
    textMatches(token, row.recipient_name) ||
    textMatches(token, row.driver_name) ||
    textMatches(token, row.description)
  );
}

/**
 * ET entre les mots : « adam 9424 » veut dire le colis d'Adam dont un numéro
 * contient 9424, pas tous les Adam plus tous les 9424.
 */
export function rowMatchesQuery(
  row: ColisSearchable,
  query: string | null | undefined
): boolean {
  const tokens = tokenise(query);
  if (!tokens.length) return true;
  return tokens.every((t) => rowMatchesToken(row, t));
}

/** `YYYY-MM-DD` et une vraie date du calendrier (2026-02-30 est refusée). */
export function isCalendarDay(day: string | null | undefined): boolean {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/** Premier instant du jour, heure de Tunis. */
export function dayStartIso(day: string): string | null {
  if (!isCalendarDay(day)) return null;
  return `${day}T00:00:00.000${TUNIS_UTC_OFFSET}`;
}

/** Dernier instant du jour, heure de Tunis — borne incluse. */
export function dayEndIso(day: string): string | null {
  if (!isCalendarDay(day)) return null;
  return `${day}T23:59:59.999${TUNIS_UTC_OFFSET}`;
}

/** Un intervalle à l'envers ne ramène rien : autant le dire tout de suite. */
export function rangeIsBackwards(
  from: string | null | undefined,
  to: string | null | undefined
): boolean {
  if (!isCalendarDay(from) || !isCalendarDay(to)) return false;
  return String(from) > String(to);
}

/** Y a-t-il quelque chose à filtrer ? Sinon la vue par défaut suffit, sans
 *  aller-retour réseau. */
export function hasFilters(filters: ColisSearchFilters): boolean {
  return Boolean(
    tokenise(filters.q).length ||
      (filters.from && filters.from.length) ||
      (filters.to && filters.to.length)
  );
}
