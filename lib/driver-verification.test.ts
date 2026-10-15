import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MAX_SCAN_BYTES,
  PIECE_CIN,
  PIECE_CONTRACT,
  PIECE_SCAN,
  SCAN_ACCEPT,
  dossierStatusLabel,
  isDossierComplete,
  missingPieces,
  scanSizeError,
  scanStoragePath,
  sniffScanType,
} from "./driver-verification.ts";

// Ce que ces tests protegent : un dashboard qui affiche « Verifie » sur un
// livreur que la base refuse de laisser travailler. C'est arrive dans l'autre
// sens (base incomplete, interface confiante) et c'est exactement le genre
// d'ecart qui fait perdre une heure a chercher au mauvais endroit.

const COMPLETE = {
  cin: "09876543",
  contract_legalized_at: "2026-10-01",
  contract_scan_path: "7f3a.../1760000000000.pdf",
};

test("les trois pieces reunies font un dossier complet", () => {
  assert.deepEqual(missingPieces(COMPLETE), []);
  assert.equal(isDossierComplete(COMPLETE), true);
  assert.equal(dossierStatusLabel(COMPLETE), "Vérifié");
});

test("chaque piece manquante est nommee, et elle seule", () => {
  assert.deepEqual(missingPieces({ ...COMPLETE, cin: null }), [PIECE_CIN]);
  assert.deepEqual(missingPieces({ ...COMPLETE, contract_legalized_at: null }), [
    PIECE_CONTRACT,
  ]);
  assert.deepEqual(missingPieces({ ...COMPLETE, contract_scan_path: null }), [
    PIECE_SCAN,
  ]);
});

test("le scan manquant suffit a refuser le dossier", () => {
  // Le coeur du changement : CIN + date ne suffisent plus.
  const sansScan = { ...COMPLETE, contract_scan_path: null };
  assert.equal(isDossierComplete(sansScan), false);
  assert.equal(dossierStatusLabel(sansScan), "En attente (scan manquant)");
});

test("une colonne absente vaut une piece manquante", () => {
  // Cas vecu : quand les colonnes de dossier manquent en base, le select de
  // repli ne ramene que le CIN. Les autres champs sont alors ABSENTS, pas null.
  assert.deepEqual(missingPieces({ cin: "09876543" }), [
    PIECE_CONTRACT,
    PIECE_SCAN,
  ]);
});

test("des espaces ne valent pas une piece", () => {
  // Meme traitement que la base : btrim(...) <> ''.
  assert.deepEqual(missingPieces({ ...COMPLETE, cin: "   " }), [PIECE_CIN]);
  assert.deepEqual(missingPieces({ ...COMPLETE, contract_scan_path: "  " }), [
    PIECE_SCAN,
  ]);
  assert.deepEqual(missingPieces({ ...COMPLETE, cin: "" }), [PIECE_CIN]);
});

test("un dossier absent manque des trois pieces", () => {
  for (const empty of [null, undefined, {}]) {
    assert.deepEqual(missingPieces(empty), [
      PIECE_CIN,
      PIECE_CONTRACT,
      PIECE_SCAN,
    ]);
    assert.equal(isDossierComplete(empty), false);
  }
  assert.equal(
    dossierStatusLabel(null),
    "En attente (CIN / contrat / scan manquants)"
  );
});

test("le libelle s accorde au nombre de pieces manquantes", () => {
  assert.equal(
    dossierStatusLabel({ ...COMPLETE, cin: null }),
    "En attente (CIN manquant)"
  );
  assert.equal(
    dossierStatusLabel({ cin: "09876543" }),
    "En attente (contrat / scan manquants)"
  );
});

test("l ordre des pieces est celui de la saisie", () => {
  // L'admin saisit le CIN au recrutement, la date au retour de la baladiya,
  // le scan quand il a le papier en main. Le libelle suit cet ordre.
  assert.deepEqual(missingPieces({}), [PIECE_CIN, PIECE_CONTRACT, PIECE_SCAN]);
});

// ── Le fichier du scan ────────────────────────────────────────────────────

/** Un en-tête de fichier, complété de zéros. */
function head(...bytes: number[]): Uint8Array {
  const out = new Uint8Array(16);
  bytes.forEach((b, i) => (out[i] = b));
  return out;
}

test("les quatre formats acceptes sont reconnus a leurs octets", () => {
  assert.equal(sniffScanType(head(0x25, 0x50, 0x44, 0x46, 0x2d)), "pdf");
  assert.equal(sniffScanType(head(0xff, 0xd8, 0xff, 0xe0)), "jpg");
  assert.equal(
    sniffScanType(head(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    "png"
  );
  assert.equal(
    sniffScanType(
      head(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50)
    ),
    "webp"
  );
});

test("un fichier mal etiquete est refuse, pas renomme", () => {
  // Un .pdf qui est en realite un ZIP, un exe, du HTML : rien de tout ca ne
  // doit entrer dans le bucket des contrats sous une extension .pdf.
  assert.equal(sniffScanType(head(0x50, 0x4b, 0x03, 0x04)), null, "zip");
  assert.equal(sniffScanType(head(0x4d, 0x5a)), null, "exe");
  assert.equal(sniffScanType(head(0x3c, 0x68, 0x74, 0x6d, 0x6c)), null, "html");
  // HEIC est explicitement hors liste : refuse au depot plutot que stocke
  // illisible.
  assert.equal(
    sniffScanType(
      head(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63)
    ),
    null,
    "heic"
  );
});

test("un RIFF qui n est pas du WEBP est refuse", () => {
  // Un .wav commence aussi par RIFF : c'est l'octet 8 qui tranche.
  assert.equal(
    sniffScanType(
      head(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45)
    ),
    null
  );
});

test("un en-tete trop court ne fait pas planter le reniflage", () => {
  assert.equal(sniffScanType(new Uint8Array(0)), null);
  assert.equal(sniffScanType(new Uint8Array([0x25, 0x50])), null);
  // RIFF seul, sans les octets 8-11 : pas assez pour conclure.
  assert.equal(
    sniffScanType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4])),
    null
  );
});

test("la taille est bornee a 10 Mo, et le vide refuse", () => {
  assert.equal(MAX_SCAN_BYTES, 10 * 1024 * 1024);
  assert.equal(scanSizeError(1), null);
  assert.equal(scanSizeError(MAX_SCAN_BYTES), null);
  assert.ok(scanSizeError(MAX_SCAN_BYTES + 1)?.includes("trop lourd"));
  assert.ok(scanSizeError(0)?.includes("vide"));
  assert.ok(scanSizeError(-1)?.includes("vide"));
  assert.ok(scanSizeError(Number.NaN)?.includes("vide"));
});

test("le message de taille dit le poids reel du fichier", () => {
  assert.ok(scanSizeError(15 * 1024 * 1024)?.includes("15.0 Mo"));
});

test("les formats annonces au selecteur sont ceux qu on accepte", () => {
  // Annoncer un type qu'on refuserait ensuite ferait echouer le depot APRES
  // l'attente du televersement.
  for (const mime of [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]) {
    assert.ok(SCAN_ACCEPT.includes(mime), mime);
  }
  assert.ok(!SCAN_ACCEPT.includes("heic"));
});

test("le chemin de stockage est <driver_id>/<timestamp>.<ext>", () => {
  assert.equal(
    scanStoragePath("7f3a0c11-0000-4000-8000-000000000001", "pdf", 1760000000000),
    "7f3a0c11-0000-4000-8000-000000000001/1760000000000.pdf"
  );
});

test("deux depots pour le meme livreur ne donnent jamais le meme chemin", () => {
  // C'est ce qui garantit que RIEN n'est ecrase : le contrat remplace reste
  // dans le bucket. Un chemin fixe avait deja casse la reprise des preuves
  // colis apres un premier essai rate.
  const a = scanStoragePath("d1", "pdf", 1760000000000);
  const b = scanStoragePath("d1", "pdf", 1760000000001);
  assert.notEqual(a, b);
});

// ── Le scan ne doit PAS entrer dans le bon colis ──────────────────────────
//
// Le bon de prise en charge est remis a un expediteur, un assureur, un
// service client. Il porte deja le CIN du livreur, ce qui est voulu et
// documente. Y ajouter son contrat de travail signe ferait circuler une piece
// qui n'a rien a voir avec le colis — et on ne la retirerait plus des copies
// deja distribuees. Ce test l'interdit par construction.

function readProjectFile(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
    .join("\n");
}

test("le scan du contrat n entre pas dans l export PDF des bons colis", () => {
  for (const file of [
    "../app/api/colis/pdf/route.ts",
    "../lib/colis-receipt-pdf.ts",
  ]) {
    const code = readProjectFile(file);
    assert.ok(
      !code.includes("contract_scan"),
      `${file} reference le scan du contrat : il ne doit pas figurer sur le bon colis`
    );
    assert.ok(
      !code.includes("driver-contracts"),
      `${file} touche au bucket des contrats : le bon colis n'a rien a y lire`
    );
  }
});

// ── La base et l'interface disent-elles la même chose ? ───────────────────
//
// La migration est la seule autorite : c'est driver_is_verified() qui garde
// les trois portes du dispatch. Ce test relit sa source et verifie qu'elle
// exige les memes colonnes que le helper ci-dessus. Il ne remplace pas le
// harnais SQL (supabase/tests/driver_contract_scan_test.sql), qui exerce la
// fonction pour de vrai ; il empeche seulement de resserrer l'une sans
// l'autre.
//
// Le fichier vit dans le depot parent. Lu depuis un clone autonome de
// cmandili_admin il est absent : le test se signale alors comme ignore plutot
// que d'echouer sur une absence qui n'est pas un defaut.

function readMigration(): string | null {
  try {
    return readFileSync(
      new URL(
        "../../supabase/migrations/20261015190000_driver_contract_scan_required.sql",
        import.meta.url
      ),
      "utf8"
    );
  } catch {
    return null;
  }
}

const migration = readMigration();

test(
  "driver_is_verified() exige les memes trois colonnes que le helper",
  { skip: migration === null ? "migration hors de ce depot" : false },
  () => {
    // Le corps de la fonction, sans les commentaires : l'en-tete de la
    // migration cite justement les trois colonnes dans sa prose, et un test
    // qui lit des commentaires teste la prose, pas le code.
    const code = migration!
      .split(/\r?\n/)
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n");

    const start = code.indexOf("create or replace function public.driver_is_verified");
    assert.ok(start >= 0, "driver_is_verified introuvable dans la migration");
    const body = code.slice(start, code.indexOf("$fn$;", start));

    for (const col of ["i.cin", "contract_legalized_at", "contract_scan_path"]) {
      assert.ok(
        body.includes(col),
        `driver_is_verified() n'exige pas ${col} alors que le helper le demande`
      );
    }

    // Et la chaine vide est bien ecartee cote base aussi, sinon un scan
    // « espace » passerait en SQL et serait refuse ici.
    assert.ok(
      body.includes("btrim(i.contract_scan_path)"),
      "driver_is_verified() accepte un chemin de scan vide"
    );

    // Le durcissement reste pilote par le reglage : sans ce court-circuit, la
    // migration bloquerait tous les livreurs en poste a la seconde du commit.
    assert.ok(
      body.includes("driver_verification_required"),
      "driver_is_verified() ne consulte plus le reglage de durcissement"
    );
  }
);
