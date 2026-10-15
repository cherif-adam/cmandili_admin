import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MIN_ID_CHARS,
  MIN_PHONE_DIGITS,
  dayEndIso,
  dayStartIso,
  foldText,
  hasFilters,
  isCalendarDay,
  normalisePhone,
  orderIdMatches,
  phoneDigits,
  phoneMatches,
  rangeIsBackwards,
  rowMatchesQuery,
  rowMatchesToken,
  textMatches,
  tokenise,
  type ColisSearchable,
} from "./colis-search.ts";

// Ce qui est testé ici décide si un colis est retrouvé ou déclaré
// introuvable. Le cas d'usage qui a motivé la recherche est une réquisition :
// un faux négatif n'est pas un désagrément d'interface.

function row(over: Partial<ColisSearchable> = {}): ColisSearchable {
  return {
    order_id: "a1b2c3d4-9526-4f2f-8af9-20712d2be019",
    sender_name: "Adam Chérif",
    sender_phone: "+216 94 240 607",
    recipient_name: "Aymen Ben Salah",
    recipient_phone: "20 123 456",
    driver_name: "Mohamed Livreur",
    driver_phone: "0021622987654",
    description: "Dossier de documents",
    ...over,
  };
}

// ── Normalisation des numéros ─────────────────────────────────────────────

test("les trois écritures du même numéro se ramènent à la forme locale", () => {
  // Les trois formes citées dans le cahier des charges.
  assert.equal(normalisePhone("94 240 607"), "94240607");
  assert.equal(normalisePhone("+21694240607"), "94240607");
  assert.equal(normalisePhone("94240607"), "94240607");
  // Et les variantes qu'on rencontre dans les profils réels.
  assert.equal(normalisePhone("+216 94 240 607"), "94240607");
  assert.equal(normalisePhone("0021694240607"), "94240607");
  assert.equal(normalisePhone("216-94-240-607"), "94240607");
  assert.equal(normalisePhone("(+216) 94.240.607"), "94240607");
});

test("un préfixe n'est retiré que s'il reste huit chiffres derrière", () => {
  // « 21612345 » EST un numéro local de 8 chiffres qui commence par 216.
  // L'amputer donnerait « 12345 » et le rendrait introuvable.
  assert.equal(normalisePhone("21612345"), "21612345");
  assert.equal(normalisePhone("216 123 45"), "21612345");
  // Idem pour le zéro de tête : « 01234567 » fait déjà 8 chiffres.
  assert.equal(normalisePhone("01234567"), "01234567");
  // En revanche, avec assez de chiffres derrière, le préfixe part bien.
  assert.equal(normalisePhone("21621612345"), "21612345");
});

test("phoneDigits ne garde que les chiffres, sans logique de préfixe", () => {
  assert.equal(phoneDigits("+216 94-240.607"), "21694240607");
  assert.equal(phoneDigits(null), "");
  assert.equal(phoneDigits(""), "");
});

test("normalisePhone encaisse l'absence de valeur", () => {
  assert.equal(normalisePhone(null), "");
  assert.equal(normalisePhone(undefined), "");
  assert.equal(normalisePhone("pas de numéro"), "");
});

// ── Correspondance des numéros ────────────────────────────────────────────

test("les trois écritures retrouvent le même enregistrement", () => {
  const stored = "+216 94 240 607";
  for (const typed of [
    "94 240 607",
    "+21694240607",
    "94240607",
    "0021694240607",
    "216 94 240 607",
  ]) {
    assert.equal(phoneMatches(typed, stored), true, `saisi : ${typed}`);
  }
});

test("une fin de numéro suffit — c'est ce que l'admin a au téléphone", () => {
  assert.equal(phoneMatches("0607", "+216 94 240 607"), true);
  assert.equal(phoneMatches("240607", "94240607"), true);
});

test("en dessous de trois chiffres, aucune correspondance téléphone", () => {
  assert.equal(MIN_PHONE_DIGITS, 3);
  assert.equal(phoneMatches("9", "94240607"), false);
  assert.equal(phoneMatches("94", "94240607"), false);
  assert.equal(phoneMatches("942", "94240607"), true);
});

test("un numéro qui ne correspond pas ne correspond pas", () => {
  assert.equal(phoneMatches("99999999", "+216 94 240 607"), false);
  assert.equal(phoneMatches("94240607", null), false);
  assert.equal(phoneMatches("94240607", ""), false);
});

// ── Texte ─────────────────────────────────────────────────────────────────

test("les accents et la casse ne font pas échouer une recherche de nom", () => {
  assert.equal(foldText("Adam Chérif"), "adam cherif");
  assert.equal(textMatches("cherif", "Adam Chérif"), true);
  assert.equal(textMatches("CHÉRIF", "Adam Cherif"), true);
  assert.equal(textMatches("adam", "ADAM CHÉRIF"), true);
});

test("les espaces superflus sont absorbés", () => {
  assert.equal(foldText("  Adam   Chérif  "), "adam cherif");
  assert.equal(textMatches("adam cherif", "Adam    Chérif"), true);
});

test("un texte absent ne correspond à rien", () => {
  assert.equal(textMatches("adam", null), false);
  assert.equal(textMatches("", "Adam"), false);
});

// ── Identifiant de commande ───────────────────────────────────────────────

test("l'identifiant court tel qu'il est affiché retrouve la commande", () => {
  const id = "a1b2c3d4-9526-4f2f-8af9-20712d2be019";
  assert.equal(orderIdMatches("a1b2c3d4", id), true);
  // Tel que la liste l'écrit : majuscules, précédé d'un dièse.
  assert.equal(orderIdMatches("#A1B2C3D4", id), true);
  // Un début suffit.
  assert.equal(orderIdMatches("a1b2", id), true);
});

test("l'UUID complet retrouve la commande, collé avec ou sans tirets", () => {
  const id = "a1b2c3d4-9526-4f2f-8af9-20712d2be019";
  assert.equal(orderIdMatches(id, id), true);
  assert.equal(orderIdMatches(id.toUpperCase(), id), true);
  assert.equal(orderIdMatches(id.replace(/-/g, ""), id), true);
});

test("en dessous de quatre caractères, aucune correspondance d'identifiant", () => {
  assert.equal(MIN_ID_CHARS, 4);
  assert.equal(orderIdMatches("a1b", "a1b2c3d4-9526-4f2f-8af9-20712d2be019"), false);
  assert.equal(orderIdMatches("a1b2", "a1b2c3d4-9526-4f2f-8af9-20712d2be019"), true);
});

test("la correspondance d'identifiant est un préfixe, pas une sous-chaîne", () => {
  const id = "a1b2c3d4-9526-4f2f-8af9-20712d2be019";
  // « 9526 » est bien dans l'UUID, mais ce n'est pas son début : l'admin lit
  // les 8 premiers caractères, pas le milieu.
  assert.equal(orderIdMatches("9526", id), false);
});

// ── Mots et combinaison ───────────────────────────────────────────────────

test("tokenise découpe sur les espaces et ignore le vide", () => {
  assert.deepEqual(tokenise("adam 9424"), ["adam", "9424"]);
  assert.deepEqual(tokenise("   adam   "), ["adam"]);
  assert.deepEqual(tokenise(""), []);
  assert.deepEqual(tokenise(null), []);
});

test("un mot cherche dans tous les champs à la fois", () => {
  const r = row();
  assert.equal(rowMatchesToken(r, "94240607"), true, "téléphone expéditeur");
  assert.equal(rowMatchesToken(r, "20123456"), true, "téléphone destinataire");
  assert.equal(rowMatchesToken(r, "22987654"), true, "téléphone livreur");
  assert.equal(rowMatchesToken(r, "a1b2c3d4"), true, "identifiant court");
  assert.equal(rowMatchesToken(r, "cherif"), true, "nom expéditeur");
  assert.equal(rowMatchesToken(r, "aymen"), true, "nom destinataire");
  assert.equal(rowMatchesToken(r, "livreur"), true, "nom livreur");
  assert.equal(rowMatchesToken(r, "documents"), true, "contenu déclaré");
  assert.equal(rowMatchesToken(r, "introuvable"), false);
});

test("plusieurs mots se cumulent : tous doivent correspondre", () => {
  const r = row();
  assert.equal(rowMatchesQuery(r, "adam 9424"), true);
  // « adam » correspond, « 99999999 » non : la ligne ne sort pas.
  assert.equal(rowMatchesQuery(r, "adam 99999999"), false);
  assert.equal(rowMatchesQuery(r, "cherif aymen livreur"), true);
});

test("une requête vide ne filtre rien", () => {
  assert.equal(rowMatchesQuery(row(), ""), true);
  assert.equal(rowMatchesQuery(row(), "   "), true);
  assert.equal(rowMatchesQuery(row(), null), true);
});

test("un bon sans nom ni numéro ne fait pas tout correspondre", () => {
  // Cas réel : bon posé par une ancienne APK, presque tout est NULL. Il ne
  // doit pas devenir le résultat universel.
  const empty = row({
    sender_name: null,
    sender_phone: null,
    recipient_name: null,
    recipient_phone: null,
    driver_name: null,
    driver_phone: null,
    description: null,
  });
  assert.equal(rowMatchesQuery(empty, "adam"), false);
  assert.equal(rowMatchesQuery(empty, "94240607"), false);
  // Son identifiant, lui, le retrouve toujours.
  assert.equal(rowMatchesQuery(empty, "a1b2c3d4"), true);
});

// ── Dates ─────────────────────────────────────────────────────────────────

test("seule une vraie date du calendrier est acceptée", () => {
  assert.equal(isCalendarDay("2026-10-15"), true);
  assert.equal(isCalendarDay("2026-02-30"), false);
  assert.equal(isCalendarDay("2026-13-01"), false);
  assert.equal(isCalendarDay("15/10/2026"), false);
  assert.equal(isCalendarDay("2026-10-15T08:00:00Z"), false);
  assert.equal(isCalendarDay(""), false);
  assert.equal(isCalendarDay(null), false);
});

test("les bornes du jour sont en heure de Tunis, incluses", () => {
  assert.equal(dayStartIso("2026-10-15"), "2026-10-15T00:00:00.000+01:00");
  assert.equal(dayEndIso("2026-10-15"), "2026-10-15T23:59:59.999+01:00");
  // Un bon déclaré à 00h30 heure de Tunis appartient bien à ce jour-là, même
  // si en UTC il est encore la veille à 23h30.
  const start = new Date(dayStartIso("2026-10-15")!).getTime();
  const end = new Date(dayEndIso("2026-10-15")!).getTime();
  const localHalfPastMidnight = new Date("2026-10-14T23:30:00.000Z").getTime();
  assert.ok(localHalfPastMidnight >= start && localHalfPastMidnight <= end);
  // Et le dernier instant du jour précédent n'y est pas.
  assert.ok(new Date("2026-10-14T22:59:59.000Z").getTime() < start);
});

test("une date invalide ne produit pas de borne", () => {
  assert.equal(dayStartIso("2026-02-30"), null);
  assert.equal(dayEndIso("pas une date"), null);
});

test("un intervalle à l'envers est signalé", () => {
  assert.equal(rangeIsBackwards("2026-10-20", "2026-10-15"), true);
  assert.equal(rangeIsBackwards("2026-10-15", "2026-10-20"), false);
  assert.equal(rangeIsBackwards("2026-10-15", "2026-10-15"), false);
  // Une borne absente n'est pas un intervalle à l'envers.
  assert.equal(rangeIsBackwards("2026-10-15", null), false);
  assert.equal(rangeIsBackwards(null, "2026-10-15"), false);
});

// ── Décision d'appeler le serveur ─────────────────────────────────────────

test("sans filtre, rien à demander au serveur", () => {
  assert.equal(hasFilters({}), false);
  assert.equal(hasFilters({ q: "   ", from: "", to: "" }), false);
  assert.equal(hasFilters({ q: "adam" }), true);
  assert.equal(hasFilters({ from: "2026-10-01" }), true);
  assert.equal(hasFilters({ to: "2026-10-31" }), true);
});
