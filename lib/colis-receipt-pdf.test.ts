import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  NOT_RECORDED,
  buildColisReceiptPdf,
  canonicalJson,
  declaredValueLabel,
  deliveryModeLabel,
  deliveryOutcomeLabel,
  disputeKindLabel,
  distanceLabel,
  formatTunis,
  gpsLabel,
  mapsLink,
  formatAddress,
  orNotRecorded,
  pdfFileName,
  receiptFingerprint,
  toWinAnsi,
  type ColisReceiptRecord,
  type ReceiptPhotos,
} from "./colis-receipt-pdf.ts";

// Le bon sert de preuve devant un service client, un assureur ou un dépôt de
// plainte. Ce qui est testé ici découle de ça : rien d'inventé, rien de vide,
// une empreinte qui ne bouge pas si la donnée ne bouge pas, et le CIN qui ne
// sort que par ce document.

const ORDER_ID = "75e8eb4b-700f-46d3-ab90-e3b26fa0f1fc";

function fullRecord(): ColisReceiptRecord {
  return {
    order: {
      id: ORDER_ID,
      created_at: "2026-10-12T08:30:00.000Z",
      status: "delivered",
      delivery_mode: "code",
      receiver_label: null,
      no_code_accepted_at: null,
    },
    sender: {
      name: "Amine Ben Salah",
      phone: "+216 20 123 456",
      address: "12 rue de la République, Kairouan",
    },
    recipient: {
      name: "Férid Mabrouk",
      phone: "+216 22 987 654",
      address: "Avenue Hédi Chaker, Sousse",
    },
    driver: {
      name: "Mohamed Trabelsi",
      phone: "+216 25 555 111",
      cin: "09876543",
      plate: "123 TU 4567",
    },
    parcel: { description: "Dossier papier scellé", declared_value: 150 },
    pickup: {
      at: "2026-10-12T09:05:00.000Z",
      lat: 35.6781,
      lng: 10.0963,
      confirmed: true,
    },
    delivery: {
      at: "2026-10-12T10:42:00.000Z",
      lat: 35.8256,
      lng: 10.6411,
      distance_m: 38,
      code_verified: true,
    },
    override: { at: null, reason: null, admin: null },
    disputes: [],
  };
}

/** Le bon réel en production : aucune preuve enregistrée. */
function emptyRecord(): ColisReceiptRecord {
  return {
    order: {
      id: ORDER_ID,
      created_at: null,
      status: null,
      delivery_mode: "no_code",
      receiver_label: null,
      no_code_accepted_at: null,
    },
    sender: { name: null, phone: null, address: null },
    recipient: { name: null, phone: null, address: null },
    driver: { name: null, phone: null, cin: null, plate: null },
    parcel: { description: null, declared_value: null },
    pickup: { at: null, lat: null, lng: null, confirmed: false },
    delivery: {
      at: null,
      lat: null,
      lng: null,
      distance_m: null,
      code_verified: null,
    },
    override: { at: null, reason: null, admin: null },
    disputes: [],
  };
}

const noPhotos: ReceiptPhotos = { pickup: null, delivery: null };

const CTX = {
  generatedAt: "2026-10-14T07:15:00.000Z",
  generatedByEmail: "admin@amana.tn",
};

// ── Données manquantes ──────────────────────────────────────────────────────

test("une valeur absente devient « Non enregistré », jamais du vide", () => {
  for (const blank of [null, undefined, "", "   "]) {
    assert.equal(orNotRecorded(blank), NOT_RECORDED);
  }
  // Et surtout : jamais une chaîne vide, qui se lirait comme un oubli.
  assert.notEqual(orNotRecorded(null), "");
});

test("une valeur présente passe telle quelle, juste rognée", () => {
  assert.equal(orNotRecorded("  Kairouan  "), "Kairouan");
  assert.equal(orNotRecorded(0), "0");
  assert.equal(orNotRecorded(false), "false");
});

test("une date absente ou illisible ne devient pas une date inventée", () => {
  assert.equal(formatTunis(null), NOT_RECORDED);
  assert.equal(formatTunis(""), NOT_RECORDED);
  assert.equal(formatTunis("pas-une-date"), NOT_RECORDED);
  // Pas d'epoch 1970 déguisée en vraie heure.
  assert.ok(!formatTunis(null).includes("1970"));
});

test("un GPS, une distance ou une valeur absents sont dits, pas mis à zéro", () => {
  assert.equal(gpsLabel(null, null), NOT_RECORDED);
  assert.equal(gpsLabel(35.6, null), NOT_RECORDED);
  assert.equal(mapsLink(null, null), null);
  assert.equal(distanceLabel(null), NOT_RECORDED);
  assert.equal(declaredValueLabel(null), NOT_RECORDED);
  // 0 est une mesure réelle et ne doit PAS devenir « Non enregistré ».
  assert.equal(distanceLabel(0), "0 m");
  assert.equal(declaredValueLabel(0), "0.000 TND");
});

test("un type de litige inconnu n'est pas traduit au hasard", () => {
  assert.equal(disputeKindLabel("not_received"), "Colis non reçu");
  assert.equal(disputeKindLabel("parcel_problem"), "Problème sur le colis");
  assert.equal(disputeKindLabel(null), NOT_RECORDED);
  assert.equal(disputeKindLabel("quelque_chose_de_neuf"), "quelque_chose_de_neuf");
});

test("statut et résolution d'un litige, qui n'existent pas en base, sont dits absents", () => {
  // colis_disputes n'a que kind, message et created_at. Le bon ne doit pas
  // faire croire qu'un litige est « ouvert » ou « résolu » : rien n'est
  // enregistré là-dessus.
  const r = fullRecord();
  r.disputes = [
    {
      created_at: "2026-10-12T12:00:00.000Z",
      kind: "not_received",
      status: null,
      resolution: null,
      message: "Jamais reçu le colis",
    },
  ];
  const bytes = buildColisReceiptPdf(r, noPhotos, CTX);
  assert.ok(bytes.byteLength > 1000);
});

// ── Heure de Tunis ──────────────────────────────────────────────────────────

test("les heures sont en heure de Tunis et le disent", () => {
  // 09:05 UTC = 10:05 à Tunis (UTC+1 fixe, pas d'heure d'été).
  const s = formatTunis("2026-10-12T09:05:00.000Z");
  assert.match(s, /12\/10\/2026/);
  assert.match(s, /10:05/);
  assert.match(s, /heure de Tunis/);
});

// ── Mode et issue de la remise ──────────────────────────────────────────────

test("le mode avec code et le mode sans code ne se confondent pas", () => {
  const withCode = deliveryModeLabel(fullRecord().order);
  assert.match(withCode, /Avec code/);

  const noCode = deliveryModeLabel({
    ...emptyRecord().order,
    receiver_label: "Gardien de l'école",
    no_code_accepted_at: "2026-10-12T08:00:00.000Z",
  });
  assert.match(noCode, /Sans code/);
  assert.match(noCode, /Gardien de l'école/);
  assert.match(noCode, /acceptation de l'expéditeur/);
});

test("le mode sans code sans libellé de receveur ne l'invente pas", () => {
  const s = deliveryModeLabel(emptyRecord().order);
  assert.match(s, /Sans code/);
  assert.match(s, new RegExp(NOT_RECORDED));
});

test("code vérifié, remise sans code et clôture forcée sont trois issues distinctes", () => {
  assert.match(deliveryOutcomeLabel(fullRecord()), /Code vérifié : oui/);

  const refused = fullRecord();
  refused.delivery.code_verified = false;
  assert.match(deliveryOutcomeLabel(refused), /Code vérifié : non/);

  const unknown = fullRecord();
  unknown.delivery.code_verified = null;
  assert.match(deliveryOutcomeLabel(unknown), new RegExp(NOT_RECORDED));

  const noCode = fullRecord();
  noCode.order.delivery_mode = "no_code";
  noCode.order.receiver_label = "Gardien de l'école";
  noCode.delivery.code_verified = null;
  assert.match(deliveryOutcomeLabel(noCode), /Remise sans code/);
});

test("une clôture forcée passe devant tout et nomme l'admin et le motif", () => {
  // C'est la seule issue où personne n'a présenté de code : la responsabilité
  // est celle de l'admin qui a signé, et le bon doit le dire même si un
  // code_verified traîne par ailleurs.
  const forced = fullRecord();
  forced.override = {
    at: "2026-10-12T18:00:00.000Z",
    reason: "Destinataire injoignable, colis remis au bureau",
    admin: "admin@amana.tn",
  };
  const s = deliveryOutcomeLabel(forced);
  assert.match(s, /Clôture forcée/);
  assert.match(s, /admin@amana\.tn/);
  assert.match(s, /Destinataire injoignable/);
  assert.ok(!s.includes("Code vérifié"));
});

test("une clôture forcée sans motif enregistré ne s'en invente pas un", () => {
  const forced = fullRecord();
  forced.override = { at: "2026-10-12T18:00:00.000Z", reason: null, admin: null };
  const s = deliveryOutcomeLabel(forced);
  assert.match(s, /Clôture forcée/);
  assert.match(s, new RegExp(NOT_RECORDED));
});

// ── Empreinte ───────────────────────────────────────────────────────────────

test("l'empreinte est stable pour la même donnée", () => {
  assert.equal(receiptFingerprint(fullRecord()), receiptFingerprint(fullRecord()));
});

test("l'empreinte ne dépend pas de l'ordre des clés", () => {
  // Deux requêtes peuvent rendre le même objet avec un ordre d'insertion
  // différent ; l'empreinte doit survivre à ça, sinon elle crie à la fraude
  // sans raison.
  const a = fullRecord();
  const b = JSON.parse(
    JSON.stringify(a, Object.keys(JSON.parse(canonicalJson(a))).reverse()),
  );
  assert.equal(canonicalJson(a), canonicalJson({ ...a }));
  assert.equal(typeof b, "object");

  const reordered: Record<string, unknown> = {};
  for (const k of Object.keys(a).reverse()) {
    reordered[k] = (a as unknown as Record<string, unknown>)[k];
  }
  assert.equal(
    receiptFingerprint(reordered as unknown as ColisReceiptRecord),
    receiptFingerprint(a),
  );
});

test("l'empreinte ne bouge pas quand l'heure d'export ou l'admin changent", () => {
  // Sinon elle serait différente à chaque clic et ne prouverait rien. On la
  // compare à travers deux PDF générés par deux admins à deux heures.
  const r = fullRecord();
  const one = receiptFingerprint(r);
  buildColisReceiptPdf(r, noPhotos, CTX);
  buildColisReceiptPdf(r, noPhotos, {
    generatedAt: "2027-01-01T00:00:00.000Z",
    generatedByEmail: "autre@amana.tn",
  });
  assert.equal(receiptFingerprint(r), one);
});

test("l'empreinte change dès qu'une donnée du bon change", () => {
  const base = receiptFingerprint(fullRecord());

  const movedGps = fullRecord();
  movedGps.delivery.lat = 35.9;
  assert.notEqual(receiptFingerprint(movedGps), base);

  const otherCode = fullRecord();
  otherCode.delivery.code_verified = false;
  assert.notEqual(receiptFingerprint(otherCode), base);

  const otherValue = fullRecord();
  otherValue.parcel.declared_value = 151;
  assert.notEqual(receiptFingerprint(otherValue), base);

  const newDispute = fullRecord();
  newDispute.disputes = [
    { created_at: "2026-10-13T00:00:00.000Z", kind: "not_received", status: null, resolution: null, message: null },
  ];
  assert.notEqual(receiptFingerprint(newDispute), base);
});

test("l'empreinte est un SHA-256 hexadécimal", () => {
  assert.match(receiptFingerprint(fullRecord()), /^[0-9a-f]{64}$/);
});

// ── Jeu de caractères ───────────────────────────────────────────────────────

test("le français passe entier dans les polices standard", () => {
  const fr = "Dépôt scellé à Kairouan — œuf, 12 € reçus, ça va";
  const { text, dropped } = toWinAnsi(fr);
  assert.equal(dropped, false);
  assert.equal(text, fr);
});

test("un texte arabe ou emoji est signalé, pas rendu en octets faux", () => {
  // L'application est quadrilingue : une description de colis en arabe est
  // possible. jsPDF ne lève pas d'erreur, il écrirait des octets illisibles —
  // un champ muet sur une pièce de preuve est pire qu'un champ qui dit qu'il
  // manque quelque chose.
  const { text, dropped } = toWinAnsi("colis نحب 📦 scellé");
  assert.equal(dropped, true);
  assert.ok(text.includes("colis"));
  assert.ok(text.includes("scellé"));
  assert.ok(!text.includes("نحب"));
});

test("un champ entièrement non latin reste visible comme tel dans le PDF", () => {
  const r = fullRecord();
  r.parcel.description = "نحب نبعث حاجة";
  const bytes = buildColisReceiptPdf(r, noPhotos, CTX);
  assert.ok(bytes.byteLength > 1000);
  // L'empreinte, elle, porte sur le texte d'origine : il reste vérifiable en
  // base même s'il ne s'imprime pas.
  assert.notEqual(receiptFingerprint(r), receiptFingerprint(fullRecord()));
});

// ── Nom de fichier ──────────────────────────────────────────────────────────

test("le nom de fichier suit bon-colis-<id court>-<date>.pdf", () => {
  assert.equal(
    pdfFileName(ORDER_ID, "2026-10-14T07:15:00.000Z"),
    "bon-colis-75e8eb4b-2026-10-14.pdf",
  );
});

test("le nom de fichier ne contient rien qui casse un en-tête HTTP", () => {
  const weird = pdfFileName('../../etc/passwd" ;', "2026-10-14T07:15:00.000Z");
  assert.ok(!weird.includes("/"));
  assert.ok(!weird.includes('"'));
  assert.ok(!weird.includes(";"));
  assert.ok(!weird.includes(".."));
  assert.match(weird, /^bon-colis-[a-zA-Z0-9]*-\d{4}-\d{2}-\d{2}\.pdf$/);
});

// ── PDF ─────────────────────────────────────────────────────────────────────

test("le document rendu est un PDF valide", () => {
  const bytes = buildColisReceiptPdf(fullRecord(), noPhotos, CTX);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  assert.ok(bytes.byteLength > 2000);
});

/**
 * Un texte français tel qu'il apparaît DANS les octets du PDF.
 *
 * Les polices standard écrivent en WinAnsi : « é » est l'octet 0xE9 et le
 * tiret cadratin « — » est l'octet 0x97. En relisant le fichier en latin1,
 * 0xE9 redonne bien « é », mais 0x97 redonne U+0097, pas U+2014 — chercher le
 * caractère Unicode ne trouve donc jamais rien. Une première version de ce
 * test échouait pour cette seule raison, sur un en-tête pourtant correct.
 */
function asWinAnsi(s: string): string {
  const extras: Record<string, number> = {
    "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86,
    "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c,
    "Ž": 0x8e, "'": 0x91, "'": 0x92, "“": 0x93, "”": 0x94,
    "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a,
    "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
  };
  return [...s]
    .map((c) => String.fromCharCode(extras[c] ?? c.charCodeAt(0)))
    .join("");
}

test("l'en-tête et le pied de page sont ceux demandés, accents compris", () => {
  // Un premier jet écrivait « electronique » sans accent dans l'en-tête et
  // rien ne l'a vu : seul l'échantillon imprimé l'a montré.
  const raw = Buffer.from(
    buildColisReceiptPdf(fullRecord(), noPhotos, CTX),
  ).toString("latin1");
  assert.ok(
    raw.includes(asWinAnsi("Amana — Bon de prise en charge électronique")),
    "en-tête exact, avec le tiret cadratin et l'accent",
  );
  assert.ok(
    raw.includes(asWinAnsi("Les preuves ne peuvent pas être modifiées après")),
    "la phrase d'intégrité doit figurer telle quelle",
  );
  for (const section of [
    "1. Commande",
    "2. Expéditeur",
    "3. Destinataire",
    "4. Livreur",
    "5. Colis",
    "6. Preuve de prise en charge",
    "7. Preuve de remise",
    "8. Litiges",
    "9. Intégrité du document",
  ]) {
    assert.ok(
      raw.includes(asWinAnsi(section)),
      `section manquante : ${section}`,
    );
  }
});

test("un bon vide affiche « Non enregistré » et pas des blancs", () => {
  const raw = Buffer.from(
    buildColisReceiptPdf(emptyRecord(), noPhotos, CTX),
  ).toString("latin1");
  const marker = asWinAnsi(NOT_RECORDED);
  // Nom, téléphone, adresses, livreur, plaque, colis, heures, GPS, photos…
  const count = raw.split(marker).length - 1;
  assert.ok(count >= 12, `attendu au moins 12 mentions, vu ${count}`);
});

test("un bon sans aucune preuve se génère quand même", () => {
  // C'est le cas du seul bon réel en production (proof_status = missing), et
  // c'est précisément celui qu'un litige réclame.
  const bytes = buildColisReceiptPdf(emptyRecord(), noPhotos, CTX);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  assert.ok(bytes.byteLength > 1000);
});

test("une photo fournie est bien intégrée au PDF", () => {
  // 2x2 JPEG rouge. Le marqueur est /DCTDecode, le filtre JPEG : il n'apparaît
  // que si les octets de l'image sont DANS le document.
  //
  // Pas /Image : tout PDF porte « /ImageB /ImageC /ImageI » dans son ProcSet,
  // donc un document sans la moindre photo contient déjà la sous-chaîne
  // « /Image » — la première version de ce test passait pour cette raison et
  // n'aurait rien détecté.
  const jpeg =
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDI0Mv/bAEMBCQkJDAsMGA0NGDIhHCEyMjIyMjIy" +
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy/8AAEQgAAgACAwEiAAIR" +
    "AQMRAf/EABUAAQEAAAAAAAAAAAAAAAAAAAAI/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABQBAQAA" +
    "AAAAAAAAAAAAAAAAAAD/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";
  const withPhoto = buildColisReceiptPdf(
    fullRecord(),
    { pickup: { base64: jpeg, format: "JPEG" }, delivery: null },
    CTX,
  );
  assert.ok(Buffer.from(withPhoto).includes(Buffer.from("/DCTDecode")));

  const without = buildColisReceiptPdf(fullRecord(), noPhotos, CTX);
  assert.ok(!Buffer.from(without).includes(Buffer.from("/DCTDecode")));
});

test("aucune URL signée ni de bucket n'entre dans le PDF", () => {
  // Une URL signée expirerait, et surtout elle ferait du PDF un jeton
  // d'accès au bucket privé pour quiconque le reçoit.
  const jpeg = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcG/9k=";
  const bytes = buildColisReceiptPdf(
    fullRecord(),
    { pickup: { base64: jpeg, format: "JPEG" }, delivery: null },
    CTX,
  );
  const raw = Buffer.from(bytes).toString("latin1");
  assert.ok(!raw.includes("token="));
  assert.ok(!raw.includes("colis-proofs"));
  assert.ok(!raw.includes("/storage/v1/"));
  assert.ok(!raw.includes("supabase.co"));
});

test("les liens présents sont des liens de carte, et seulement ça", () => {
  const bytes = buildColisReceiptPdf(fullRecord(), noPhotos, CTX);
  const raw = Buffer.from(bytes).toString("latin1");
  assert.ok(raw.includes("google.com/maps"));
});

test("un bon sans GPS ne contient aucun lien de carte", () => {
  const bytes = buildColisReceiptPdf(emptyRecord(), noPhotos, CTX);
  const raw = Buffer.from(bytes).toString("latin1");
  assert.ok(!raw.includes("google.com/maps"));
});

// ── CIN ─────────────────────────────────────────────────────────────────────

test("le CIN n'est présent que s'il est dans l'enregistrement", () => {
  // Le PDF admin le porte ; un bon sans CIN figé ne doit pas en faire
  // apparaître un, ni laisser le champ vide.
  const withCin = fullRecord();
  const withoutCin = fullRecord();
  withoutCin.driver.cin = null;

  // Les deux documents diffèrent, et c'est bien le CIN qui fait la
  // différence : l'empreinte le couvre.
  assert.notEqual(receiptFingerprint(withCin), receiptFingerprint(withoutCin));

  const bytes = buildColisReceiptPdf(withoutCin, noPhotos, CTX);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
});

// ── Contrôle d'accès de la route ────────────────────────────────────────────
//
// La route elle-même a besoin d'une session Supabase et d'un serveur : elle
// est vérifiée en direct (curl sans cookie -> 403). Ce qui suit verrouille le
// contrat dans la source, pour qu'un refactor ne retire pas la barrière sans
// que rien ne proteste. La vraie défense reste requireAdmin() au moment de
// l'exécution ; ces tests empêchent seulement de la supprimer en silence.

const routeSource = readFileSync(
  new URL("../app/api/colis/pdf/route.ts", import.meta.url),
  "utf8",
);

/** Source sans commentaires : ce fichier et la route parlent tous deux de
 *  requireAdmin et de CIN dans leurs explications, et un test d'absence qui
 *  lit des commentaires teste la prose, pas le code. */
const routeCode = routeSource
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((l) => (/^\s*\/\//.test(l) ? "" : l))
  .join("\n");

test("la route refuse qui n'est pas admin, dans le handler lui-même", () => {
  assert.match(routeCode, /const admin = await requireAdmin\(\)/);
  assert.match(routeCode, /if \(!admin\) return NextResponse\.json\(\s*\{ error: "Forbidden" \},\s*\{ status: 403 \}/);
  // Le proxy protège les pages, pas une route API appelée directement.
  assert.ok(
    routeCode.indexOf("requireAdmin()") < routeCode.indexOf("colis_receipts"),
    "l'autorisation doit précéder toute lecture de données",
  );
});

test("la route n'expose que GET", () => {
  // Un POST/PUT sur un export serait au mieux inutile ; Next renvoie 405 pour
  // les méthodes non exportées, à condition qu'on n'en exporte pas d'autres.
  const exported = [...routeCode.matchAll(/export async function (\w+)/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(exported, ["GET"]);
});

test("le CIN ne sort que dans le PDF, jamais dans le journal d'audit", () => {
  // Le journal est lisible par tout admin : y réécrire le numéro le
  // diffuserait une seconde fois, hors du document qui le justifie. On note
  // qu'il était présent, pas sa valeur.
  assert.match(routeCode, /cin_included: identity\?\.driver_cin \? true : false/);
  const auditBlock = routeCode.slice(routeCode.indexOf("logAudit({"));
  assert.ok(
    !/driver_cin\s*(,|\n|\})/.test(auditBlock.replace("cin_included: identity?.driver_cin ? true : false", "")),
    "la valeur du CIN ne doit pas entrer dans les détails d'audit",
  );
  assert.ok(!auditBlock.includes("cin:"), "pas de champ cin dans l'audit");
});

test("les photos sont téléchargées côté serveur, jamais signées", () => {
  assert.match(routeCode, /\.download\(path\)/);
  assert.ok(
    !routeCode.includes("createSignedUrl"),
    "une URL signée dans ce PDF le transformerait en jeton d'accès au bucket",
  );
  assert.ok(!routeCode.includes("getPublicUrl"));
});

test("le PDF est streamé en pièce jointe et n'est pas stocké", () => {
  assert.match(routeCode, /"Content-Type": "application\/pdf"/);
  assert.match(routeCode, /attachment; filename=/);
  assert.match(routeCode, /"Cache-Control": "no-store/);
  // Rien ne remonte dans un bucket.
  assert.ok(!routeCode.includes(".upload("));
});

test("l'export est journalisé avec la commande et l'admin", () => {
  assert.match(routeCode, /action_type: "colis_receipt_pdf_export"/);
  assert.match(routeCode, /target_id: orderId/);
  assert.match(routeCode, /admin_id: admin\.id/);
});

// ── Adresses ────────────────────────────────────────────────────────────────

test("une adresse JSONB devient du texte, jamais « [object Object] »", () => {
  // orders.pickup_address / delivery_address sont du JSONB. La première
  // version imprimait « [object Object] » sur les deux lignes du bon réel —
  // du bruit qui a l'air d'une donnée, pire qu'un blanc sur une preuve.
  const addr = {
    apartmentNumber: null,
    floor: null,
    fullAddress: "M3RX+HGG Derrière la municipalité de, Kairouan, Tunisie",
    id: "1791907698258",
    instructions: null,
    isDefault: false,
    label: "Adresse de livraison",
    latitude: 35.691414481953,
    longitude: 10.098676197230816,
    phone: null,
    recipientName: null,
  };
  const s = formatAddress(addr);
  assert.ok(!s.includes("[object"));
  assert.equal(s, "M3RX+HGG Derrière la municipalité de, Kairouan, Tunisie");
});

test("étage, appartement et indications sont repris quand ils existent", () => {
  const s = formatAddress({
    fullAddress: "Avenue Hédi Chaker, Sousse",
    apartmentNumber: "12B",
    floor: "3",
    instructions: "Sonner chez le voisin",
  });
  assert.match(s, /Avenue Hédi Chaker/);
  assert.match(s, /appartement 12B/);
  assert.match(s, /étage 3/);
  assert.match(s, /Sonner chez le voisin/);
});

test("une adresse absente ou vide est dite, pas imprimée en accolades", () => {
  assert.equal(formatAddress(null), NOT_RECORDED);
  assert.equal(formatAddress(undefined), NOT_RECORDED);
  assert.equal(formatAddress({}), NOT_RECORDED);
  assert.equal(formatAddress({ label: "Adresse de livraison" }), NOT_RECORDED);
  assert.equal(formatAddress("   "), NOT_RECORDED);
});

test("une adresse déjà en texte passe telle quelle", () => {
  assert.equal(formatAddress("12 rue de la République, Kairouan"),
    "12 rue de la République, Kairouan");
});

test("le PDF d'un bon réel ne contient jamais « [object Object] »", () => {
  const r = fullRecord();
  r.sender.address = { fullAddress: "M4G5+8HC, Kairouan, Tunisie" };
  r.recipient.address = { fullAddress: "M3RX+HGG, Kairouan, Tunisie" };
  const raw = Buffer.from(
    buildColisReceiptPdf(r, noPhotos, CTX),
  ).toString("latin1");
  assert.ok(!raw.includes("[object"));
  assert.ok(raw.includes("M4G5+8HC"));
});

test("canonicalJson gère les imbrications et les tableaux", () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(canonicalJson({ a: { d: 1, c: 2 } }), '{"a":{"c":2,"d":1}}');
  assert.equal(canonicalJson([{ b: 1, a: 2 }]), '[{"a":2,"b":1}]');
  assert.equal(canonicalJson(null), "null");
});
