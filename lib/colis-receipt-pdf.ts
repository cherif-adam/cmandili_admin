import { createHash } from "node:crypto";
import { jsPDF } from "jspdf";

/**
 * Bon de prise en charge Colis — rendu PDF.
 *
 * Ce fichier ne lit rien et n'écrit rien : il reçoit un enregistrement déjà
 * constitué et rend des octets. C'est voulu — la route API fait l'accès aux
 * données et l'autorisation, tout le reste est testable sans base ni réseau
 * (`node --test "lib/**\/*.test.ts"`).
 *
 * Le document sert de preuve devant un service client, un assureur ou un
 * dépôt de plainte. Trois règles en découlent :
 *
 *   1. Une donnée absente est écrite « Non enregistré », jamais laissée vide
 *      et jamais devinée. Un blanc se lit comme un oubli de mise en page ;
 *      « Non enregistré » dit que le serveur n'a rien reçu, ce qui est une
 *      information en soi dans un litige.
 *   2. L'empreinte en pied de page porte sur l'ENREGISTREMENT seul, pas sur
 *      l'heure ni sur l'admin qui exporte. Deux exports du même bon donnent
 *      donc la même empreinte, et une divergence signifie que la donnée a
 *      changé — c'est tout l'intérêt. Inclure l'horodatage de génération
 *      rendrait l'empreinte différente à chaque clic et donc inutile.
 *   3. Aucune URL signée ni publique n'entre dans le PDF. Les photos sont
 *      intégrées en dur, octets compris, par la route.
 */

export const NOT_RECORDED = "Non enregistré";

export interface ColisDisputeRecord {
  created_at: string | null;
  kind: string | null;
  /** Les colonnes status/resolution n'existent pas encore sur
   *  colis_disputes ; typées ici pour que l'ajout d'une colonne n'impose pas
   *  de retoucher le rendu. En attendant : « Non enregistré ». */
  status: string | null;
  resolution: string | null;
  message: string | null;
}

export interface ColisReceiptRecord {
  order: {
    id: string;
    created_at: string | null;
    status: string | null;
    delivery_mode: string;
    receiver_label: string | null;
    no_code_accepted_at: string | null;
    /** pending | pickup_only | complete | missing. 'missing' = livrée par une
     *  ancienne version de l'app livreur, sans aucune preuve enregistrée. */
    proof_status: string | null;
  };
  sender: { name: string | null; phone: string | null; address: unknown };
  recipient: { name: string | null; phone: string | null; address: unknown };
  /** Ce que le bon a réellement FIGÉ à la prise en charge, et rien d'autre.
   *  Le téléphone n'y est pas : il n'a jamais été figé, il vient donc des
   *  données courantes (voir CurrentFallbacks) et n'entre pas dans
   *  l'empreinte — sinon celle-ci changerait le jour où le livreur change de
   *  numéro, ce qui n'est pas ce qu'elle atteste. */
  driver: {
    name: string | null;
    cin: string | null;
    plate: string | null;
  };
  parcel: { description: string | null; declared_value: number | null };
  pickup: {
    at: string | null;
    lat: number | null;
    lng: number | null;
    confirmed: boolean;
  };
  delivery: {
    at: string | null;
    lat: number | null;
    lng: number | null;
    distance_m: number | null;
    code_verified: boolean | null;
  };
  override: { at: string | null; reason: string | null; admin: string | null };
  disputes: ColisDisputeRecord[];
}

/**
 * Données COURANTES, utilisées seulement quand le bon n'a rien figé.
 *
 * Une commande livrée par une ancienne version de l'app livreur n'a figé ni
 * nom, ni plaque, ni CIN : le bon affichait alors « Non enregistré » partout
 * côté livreur alors que la commande porte un driver_id et qu'on sait donc
 * parfaitement qui a livré. Pour une pièce de preuve, taire une information
 * qu'on détient est un défaut.
 *
 * Séparé de [ColisReceiptRecord] à dessein, et NON pris dans l'empreinte :
 * ces valeurs peuvent changer après coup (un livreur change de numéro, un
 * client renomme son profil). Les faire entrer dans l'empreinte la ferait
 * varier sans qu'aucune preuve n'ait bougé. Le figé l'emporte toujours quand
 * il existe, et tout ce qui vient d'ici est signalé dans le document, champ
 * par champ, puis récapitulé en section 9.
 */
export interface CurrentFallbacks {
  driver: {
    name: string | null;
    phone: string | null;
    cin: string | null;
    plate: string | null;
  } | null;
  senderName: string | null;
}

/** Photos déjà téléchargées depuis le bucket privé, en base64 brut. */
export interface ReceiptPhotos {
  pickup: { base64: string; format: "JPEG" | "PNG" } | null;
  delivery: { base64: string; format: "JPEG" | "PNG" } | null;
}

export interface GenerationContext {
  /** ISO. Horodatage de l'export, affiché en en-tête. */
  generatedAt: string;
  /** Qui a exporté. Un document de preuve dit qui l'a produit. */
  generatedByEmail: string;
}

// ── Formatage ───────────────────────────────────────────────────────────────

/** Vrai pour une valeur que le serveur n'a pas enregistrée. */
function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && !v.trim());
}

export function orNotRecorded(v: unknown): string {
  return isBlank(v) ? NOT_RECORDED : String(v).trim();
}

/**
 * Horodatage serveur en heure de Tunis.
 *
 * Africa/Tunis est UTC+1 fixe, sans heure d'été, mais on passe quand même par
 * le fuseau nommé : une preuve ne doit pas dépendre d'un décalage recopié à
 * la main. Le suffixe rappelle le fuseau, sans quoi « 14:30 » ne veut rien
 * dire dans un dossier d'assurance.
 */
export function formatTunis(iso: string | null | undefined): string {
  if (isBlank(iso)) return NOT_RECORDED;
  const d = new Date(iso as string);
  if (Number.isNaN(d.getTime())) return NOT_RECORDED;
  const s = d.toLocaleString("fr-FR", {
    timeZone: "Africa/Tunis",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${s} (heure de Tunis)`;
}

export function gpsLabel(lat: number | null, lng: number | null): string {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return NOT_RECORDED;
  }
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function mapsLink(lat: number | null, lng: number | null): string | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Adresse lisible à partir de la colonne `orders.*_address`.
 *
 * Ces colonnes sont du JSONB, pas du texte : l'application y range tout
 * l'objet adresse (fullAddress, étage, appartement, indications, position).
 * Les passer à String() donne « [object Object] », ce qui est pire qu'un
 * blanc sur une pièce de preuve — c'est du bruit qui a l'air d'une donnée.
 * Trouvé en générant l'échantillon depuis le bon réel.
 *
 * Tolère aussi une chaîne, au cas où d'anciennes lignes en portent une.
 */
export function formatAddress(value: unknown): string {
  if (value === null || value === undefined) return NOT_RECORDED;
  if (typeof value === "string") return orNotRecorded(value);
  if (typeof value !== "object") return orNotRecorded(value);

  const a = value as Record<string, unknown>;
  const parts: string[] = [];

  const full = a.fullAddress ?? a.full_address ?? a.address;
  if (!isBlank(full)) parts.push(String(full).trim());

  const apt = a.apartmentNumber ?? a.apartment_number;
  if (!isBlank(apt)) parts.push(`appartement ${String(apt).trim()}`);

  const floor = a.floor;
  if (!isBlank(floor)) parts.push(`étage ${String(floor).trim()}`);

  if (!isBlank(a.instructions)) {
    parts.push(`indications : ${String(a.instructions).trim()}`);
  }

  // Un objet sans aucun champ exploitable n'est pas une adresse. On le dit
  // plutôt que d'imprimer des accolades.
  return parts.length === 0 ? NOT_RECORDED : parts.join(" — ");
}

export function declaredValueLabel(v: number | null): string {
  if (v === null || v === undefined) return NOT_RECORDED;
  return `${v.toFixed(3)} TND`;
}

export function distanceLabel(m: number | null): string {
  if (m === null || m === undefined) return NOT_RECORDED;
  return `${m} m`;
}

/** « Avec code » / « Sans code — remise à <label>, accepté le <date> ». */
export function deliveryModeLabel(order: ColisReceiptRecord["order"]): string {
  if (order.delivery_mode === "no_code") {
    return [
      "Sans code",
      `remise à : ${orNotRecorded(order.receiver_label)}`,
      `acceptation de l'expéditeur : ${formatTunis(order.no_code_accepted_at)}`,
    ].join(" — ");
  }
  if (order.delivery_mode === "code") return "Avec code à 4 chiffres";
  return orNotRecorded(order.delivery_mode);
}

/**
 * Comment la remise s'est conclue.
 *
 * Trois issues possibles et elles ne se confondent pas : code vérifié, remise
 * sans code, ou clôture forcée par un admin. La clôture forcée passe devant,
 * car c'est la seule où personne n'a présenté de code et où la responsabilité
 * est celle de l'admin qui a signé.
 */
export function deliveryOutcomeLabel(record: ColisReceiptRecord): string {
  const { override, delivery, order } = record;
  if (!isBlank(override.at)) {
    return [
      "Clôture forcée par un administrateur",
      `administrateur : ${orNotRecorded(override.admin)}`,
      `motif : ${orNotRecorded(override.reason)}`,
      `le ${formatTunis(override.at)}`,
    ].join(" — ");
  }
  if (order.delivery_mode === "no_code") {
    return `Remise sans code à : ${orNotRecorded(order.receiver_label)}`;
  }
  if (delivery.code_verified === true) return "Code vérifié : oui";
  if (delivery.code_verified === false) return "Code vérifié : non";
  return `Code vérifié : ${NOT_RECORDED}`;
}

/**
 * Les 8 statuts que la contrainte `orders_status_check` accepte, en français.
 *
 * La casse compte : l'app Flutter sérialise ses enums via
 * `toString().split('.').last`, d'où `pickedUp` et `onTheWay` et jamais
 * `picked_up` ni `on_the_way`. Un statut inconnu est rendu tel quel plutôt
 * que traduit au hasard — un libellé inventé sur une preuve est pire qu'un
 * mot anglais.
 */
const ORDER_STATUS_FR: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête",
  pickedUp: "Récupérée par le livreur",
  onTheWay: "En route",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export function orderStatusLabel(status: string | null): string {
  if (isBlank(status)) return NOT_RECORDED;
  return ORDER_STATUS_FR[status as string] ?? (status as string);
}

/** Suffixe porté par toute valeur qui ne vient pas du bon figé. */
export const CURRENT_SUFFIX = "(actuel — non figé à la prise en charge)";

export interface SourcedValue {
  /** Prêt à imprimer, suffixe compris. */
  text: string;
  /** Vrai quand la valeur vient des données courantes, pas du bon figé. */
  fromCurrent: boolean;
}

/**
 * Valeur figée si elle existe, sinon valeur courante, sinon « Non enregistré ».
 *
 * Le figé l'emporte TOUJOURS : c'est lui qui a valeur de preuve, et une
 * plaque modifiée depuis ne doit jamais réécrire celle du jour de la remise.
 */
export function sourcedValue(
  frozen: unknown,
  current: unknown,
): SourcedValue {
  if (!isBlank(frozen)) {
    return { text: String(frozen).trim(), fromCurrent: false };
  }
  if (!isBlank(current)) {
    return { text: `${String(current).trim()} ${CURRENT_SUFFIX}`, fromCurrent: true };
  }
  return { text: NOT_RECORDED, fromCurrent: false };
}

/** Avertissement en tête des sections 6 et 7 quand aucune preuve n'existe. */
export const NO_PROOF_NOTICE =
  "Livraison effectuée avec une ancienne version de l'application livreur : " +
  "preuves photo et GPS non disponibles pour cette commande.";

export function disputeKindLabel(kind: string | null): string {
  switch (kind) {
    case "not_received":
      return "Colis non reçu";
    case "parcel_problem":
      return "Problème sur le colis";
    default:
      return orNotRecorded(kind);
  }
}

/** bon-colis-<8 premiers caractères de l'id>-<AAAA-MM-JJ>.pdf */
export function pdfFileName(orderId: string, generatedAt: string): string {
  const short = (orderId || "inconnu").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const d = new Date(generatedAt);
  const day = Number.isNaN(d.getTime())
    ? "date-inconnue"
    : d.toLocaleDateString("en-CA", { timeZone: "Africa/Tunis" });
  return `bon-colis-${short || "inconnu"}-${day}.pdf`;
}

// ── Jeu de caractères ───────────────────────────────────────────────────────

/**
 * Les polices standard de jsPDF écrivent en WinAnsi (Latin-1 étendu), ce qui
 * couvre tout le français — é, à, ç, ô, œ… Elles ne couvrent PAS l'arabe ni
 * les emoji, et l'application est quadrilingue : une description de colis
 * saisie en arabe est donc possible.
 *
 * jsPDF ne lève pas d'erreur dans ce cas, il écrit des octets faux — un champ
 * qui devient illisible sans que personne ne s'en aperçoive est inacceptable
 * sur un document de preuve. On remplace donc explicitement, et le champ le
 * dit. L'empreinte, elle, porte sur la donnée d'origine : le texte exact
 * reste vérifiable en base même s'il ne s'imprime pas ici.
 */
/**
 * Les 27 caractères que WinAnsi (CP1252) place dans 0x80–0x9F et que Latin-1
 * ne contient pas.
 *
 * Indispensable, et pas un détail : le tiret cadratin « — », l'apostrophe
 * typographique « ’ », les guillemets « “ ” » et les points de suspension
 * « … » sont tous là-dedans. Une première version s'arrêtait à 0xFF et jetait
 * donc la ponctuation française de ses propres libellés.
 */
const WIN_ANSI_EXTRAS = new Set(
  [
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
    0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
    0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
  ],
);

export function toWinAnsi(input: string): { text: string; dropped: boolean } {
  let dropped = false;
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    // Tabulation et saut de ligne sont convertis en espace par le rendu.
    if (ch === "\n" || ch === "\t") {
      out += " ";
      continue;
    }
    if (code >= 0x20 && code <= 0xff) {
      out += ch;
      continue;
    }
    if (WIN_ANSI_EXTRAS.has(code)) {
      out += ch;
      continue;
    }
    dropped = true;
  }
  const text = out.replace(/\s+/g, " ").trim();
  return { text, dropped };
}

/** Texte prêt à imprimer : WinAnsi, et signalé si des caractères sont tombés. */
function printable(value: unknown): string {
  const raw = orNotRecorded(value);
  if (raw === NOT_RECORDED) return raw;
  const { text, dropped } = toWinAnsi(raw);
  if (!dropped) return text;
  if (!text) return "(caractères non imprimables — voir l'enregistrement)";
  return `${text} (caractères non imprimables omis)`;
}

// ── Empreinte d'intégrité ───────────────────────────────────────────────────

/**
 * JSON canonique : clés triées récursivement, pour que deux objets égaux
 * donnent exactement la même chaîne. `JSON.stringify` conserve l'ordre
 * d'insertion, donc le même enregistrement lu par deux requêtes différentes
 * pourrait sinon produire deux empreintes.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

/**
 * SHA-256 de l'enregistrement, en hexadécimal.
 *
 * Porte sur le dossier et sur lui seul : ni l'heure d'export ni l'admin
 * n'entrent dedans. Réexporter le même bon doit redonner la même empreinte,
 * sinon elle ne prouve rien.
 *
 * Ce n'est pas une signature : elle atteste que le PDF correspond bien aux
 * enregistrements au moment de l'export, pas que le PDF n'a pas été retouché
 * ensuite. Le pied de page ne prétend rien de plus.
 */
export function receiptFingerprint(record: ColisReceiptRecord): string {
  return createHash("sha256").update(canonicalJson(record), "utf8").digest("hex");
}

// ── Rendu ───────────────────────────────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LABEL_W = 52;

export function buildColisReceiptPdf(
  record: ColisReceiptRecord,
  photos: ReceiptPhotos,
  ctx: GenerationContext,
  fallbacks: CurrentFallbacks = { driver: null, senderName: null },
): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const fingerprint = receiptFingerprint(record);
  let y = MARGIN;

  // Récapitulé en section 9 : un lecteur doit pouvoir voir d'un coup d'œil ce
  // que l'empreinte couvre et ce qu'elle ne couvre pas.
  const fromCurrent: string[] = [];
  const sourcedRow = (label: string, frozen: unknown, current: unknown) => {
    const v = sourcedValue(frozen, current);
    if (v.fromCurrent) fromCurrent.push(label);
    return v;
  };

  const ensureRoom = (needed: number) => {
    if (y + needed <= PAGE_H - MARGIN - 12) return;
    doc.addPage();
    y = MARGIN;
  };

  // En-tête
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Amana — Bon de prise en charge électronique", MARGIN, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Commande : ${printable(record.order.id)}`, MARGIN, y);
  y += 4.5;
  doc.text(`Document généré le ${formatTunis(ctx.generatedAt)}`, MARGIN, y);
  y += 4.5;
  doc.text(
    `Par l'administrateur : ${printable(ctx.generatedByEmail)}`,
    MARGIN,
    y,
  );
  y += 4;
  doc.setDrawColor(150);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  const section = (title: string) => {
    ensureRoom(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
  };

  const row = (label: string, value: string, link?: string | null) => {
    const lines = doc.splitTextToSize(value, CONTENT_W - LABEL_W) as string[];
    ensureRoom(lines.length * 4.4 + 2);
    doc.setTextColor(90);
    doc.text(label, MARGIN, y);
    doc.setTextColor(20);
    doc.text(lines, MARGIN + LABEL_W, y);
    if (link) {
      // textWithLink placerait le texte ET le lien ; ici le texte est déjà
      // posé, on ne veut que la zone cliquable, ligne par ligne.
      doc.link(MARGIN + LABEL_W, y - 3.2, CONTENT_W - LABEL_W, 4.4, {
        url: link,
      });
    }
    y += lines.length * 4.4 + 1.6;
    doc.setTextColor(20);
  };

  /**
   * Coordonnées + lien carte, sur une seule entrée.
   *
   * L'URL est écrite en clair sous les coordonnées, pas seulement posée en
   * zone cliquable : ce document est fait pour être imprimé sur A4 et remis à
   * un assureur ou joint à une plainte, et un lien cliquable ne sert à rien
   * sur du papier.
   */
  const gpsRow = (label: string, lat: number | null, lng: number | null) => {
    const link = mapsLink(lat, lng);
    if (!link) {
      row(label, NOT_RECORDED);
      return;
    }
    row(label, `${gpsLabel(lat, lng)}\n${link}`, link);
  };

  /**
   * Photo intégrée, ou la mention explicite de son absence.
   *
   * Closure sur `y` à dessein : une version qui recevait `y` en paramètre
   * gardait une valeur périmée quand le saut de page la remettait à MARGIN,
   * et dessinait la photo hors de la page.
   *
   * Les octets viennent du bucket privé via la route ; aucune URL signée
   * n'entre dans le document — elle expirerait, et surtout elle donnerait un
   * accès au bucket à quiconque reçoit le PDF.
   */
  const photoRow = (photo: ReceiptPhotos["pickup"]) => {
    if (!photo) {
      ensureRoom(8);
      doc.setTextColor(90);
      doc.text(`Photo : ${NOT_RECORDED}`, MARGIN, y);
      doc.setTextColor(20);
      y += 6;
      return;
    }
    const side = 62;
    ensureRoom(side + 8);
    doc.setTextColor(90);
    doc.text("Photo :", MARGIN, y);
    doc.setTextColor(20);
    try {
      doc.addImage(
        `data:image/${photo.format.toLowerCase()};base64,${photo.base64}`,
        photo.format,
        MARGIN + LABEL_W,
        y - 4,
        side,
        side,
      );
      y += side + 4;
    } catch {
      // Une photo illisible ne doit pas priver l'admin du reste du bon : le
      // document le dit et continue.
      doc.setTextColor(90);
      doc.text("photo illisible (enregistrement présent)", MARGIN + LABEL_W, y);
      doc.setTextColor(20);
      y += 6;
    }
  };

  // 1. Commande
  section("1. Commande");
  row("Identifiant", printable(record.order.id));
  row("Créée le", formatTunis(record.order.created_at));
  row("Mode de remise", printable(deliveryModeLabel(record.order)));
  row("Statut", printable(orderStatusLabel(record.order.status)));

  // 2. Expéditeur
  section("2. Expéditeur");
  row(
    "Nom",
    printable(sourcedRow("Expéditeur — nom", record.sender.name, fallbacks.senderName).text),
  );
  row("Téléphone", printable(record.sender.phone));
  row("Adresse d'enlèvement", printable(formatAddress(record.sender.address)));

  // 3. Destinataire
  section("3. Destinataire");
  row("Nom", printable(record.recipient.name));
  row("Téléphone", printable(record.recipient.phone));
  row("Adresse de livraison", printable(formatAddress(record.recipient.address)));

  // 4. Livreur
  section("4. Livreur");
  // Le figé l'emporte ; à défaut, les données courantes du livreur de la
  // commande, chaque valeur portant alors sa provenance.
  row("Nom", printable(sourcedRow("Livreur — nom", record.driver.name, fallbacks.driver?.name).text));
  row(
    "Téléphone",
    printable(sourcedRow("Livreur — téléphone", null, fallbacks.driver?.phone).text),
  );
  row("CIN", printable(sourcedRow("Livreur — CIN", record.driver.cin, fallbacks.driver?.cin).text));
  row(
    "Plaque",
    printable(sourcedRow("Livreur — plaque", record.driver.plate, fallbacks.driver?.plate).text),
  );

  // 5. Colis
  section("5. Colis");
  row("Description", printable(record.parcel.description));
  row("Valeur déclarée", declaredValueLabel(record.parcel.declared_value));

  /**
   * Pourquoi les sections 6 et 7 sont vides, quand elles le sont.
   *
   * Sans cette ligne, une section entièrement « Non enregistré » se lit comme
   * un livreur qui n'a rien fait, voire comme une preuve effacée. La cause
   * réelle est l'ancienne version de l'app livreur, et c'est ce que le
   * document doit dire — surtout à un assureur.
   */
  const noProofNotice = () => {
    if (record.order.proof_status !== "missing") return;
    const lines = doc.splitTextToSize(NO_PROOF_NOTICE, CONTENT_W) as string[];
    ensureRoom(lines.length * 4.2 + 3);
    doc.setTextColor(150, 60, 0);
    doc.text(lines, MARGIN, y);
    doc.setTextColor(20);
    y += lines.length * 4.2 + 2.5;
  };

  // 6. Preuve de prise en charge
  section("6. Preuve de prise en charge");
  noProofNotice();
  row("Heure serveur", formatTunis(record.pickup.at));
  gpsRow("Coordonnées GPS", record.pickup.lat, record.pickup.lng);
  row(
    "Confirmation du livreur",
    record.pickup.confirmed ? "Oui" : NOT_RECORDED,
  );
  photoRow(photos.pickup);

  // 7. Preuve de remise
  section("7. Preuve de remise");
  noProofNotice();
  row("Heure serveur", formatTunis(record.delivery.at));
  gpsRow("Coordonnées GPS", record.delivery.lat, record.delivery.lng);
  row("Distance à l'adresse", distanceLabel(record.delivery.distance_m));
  row("Issue", printable(deliveryOutcomeLabel(record)));
  photoRow(photos.delivery);

  // 8. Litiges
  section("8. Litiges");
  if (record.disputes.length === 0) {
    row("Litiges", "Aucun litige enregistré");
  } else {
    record.disputes.forEach((d, i) => {
      row(`Litige ${i + 1} — date`, formatTunis(d.created_at));
      row("Type", printable(disputeKindLabel(d.kind)));
      row("Statut", printable(d.status));
      row("Résolution", printable(d.resolution));
      if (!isBlank(d.message)) row("Message", printable(d.message));
    });
  }

  // 9. Intégrité
  section("9. Intégrité du document");
  row("Empreinte SHA-256", fingerprint);
  // Ce que l'empreinte NE couvre pas. Un lecteur doit pouvoir distinguer ce
  // qui a valeur de preuve de ce qui n'est qu'une aide à l'identification.
  row(
    "Champs hors empreinte",
    fromCurrent.length === 0
      ? "Aucun : toutes les valeurs affichées proviennent du bon figé."
      : `${fromCurrent.join(", ")} — ${printable(
          "valeurs actuelles, non figées à la prise en charge et donc hors empreinte",
        )}.`,
  );
  ensureRoom(16);
  doc.setFontSize(8.5);
  doc.setTextColor(90);
  const footer = doc.splitTextToSize(
    "Document généré à partir des enregistrements horodatés du serveur Amana. " +
      "Les preuves ne peuvent pas être modifiées après enregistrement.",
    CONTENT_W,
  ) as string[];
  doc.text(footer, MARGIN, y);
  y += footer.length * 3.6 + 2;
  doc.text(
    "L'empreinte porte sur les données du bon, hors heure d'export et identité de l'exportateur : " +
      "un même bon réexporté donne la même empreinte.",
    MARGIN,
    y,
    { maxWidth: CONTENT_W },
  );
  doc.setTextColor(20);

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

