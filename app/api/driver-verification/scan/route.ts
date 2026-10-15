import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";
import {
  MAX_SCAN_BYTES,
  isDossierComplete,
  scanSizeError,
  scanStoragePath,
  sniffScanType,
} from "@/lib/driver-verification";

/**
 * Scan du contrat signé et légalisé — dépôt, remplacement et consultation.
 *
 *   POST  dépose un scan (ou en dépose un nouveau à la place de l'ancien)
 *   GET   rend une URL signée de courte durée pour l'ouvrir
 *
 * requireAdmin() est revérifié dans CHAQUE handler. Une route API répond
 * directement à qui connaît son URL, et celle-ci dépose puis rend un document
 * portant une signature et une pièce d'identité : c'est la seule barrière qui
 * compte. Même raisonnement que l'export PDF des bons colis.
 *
 * RIEN N'EST JAMAIS ÉCRASÉ. Le chemin porte un horodatage, et l'envoi se fait
 * en upsert: false. Remplacer un contrat écrit un nouvel objet et laisse
 * l'ancien dans le bucket : le contrat remplacé est précisément la pièce qu'un
 * litige peut réclamer. Le remplacement est journalisé avec l'ancien et le
 * nouveau chemin, pour qu'on puisse retrouver la version précédente.
 *
 * ORDRE DES OPÉRATIONS : on envoie le fichier, PUIS on met à jour la ligne.
 * L'inverse laisserait, en cas d'échec de l'envoi, une ligne qui pointe vers
 * un fichier inexistant — un dossier « complet » sans document. Dans ce
 * sens-là, le pire cas est un objet orphelin dans un bucket privé, que le
 * journal d'audit permet de retrouver.
 *
 * Le bucket driver-contracts est privé, avec une policy admin-only sur
 * storage.objects (20261015090000). supabaseAdmin (service_role) la traverse,
 * et c'est voulu : c'est exactement le rôle qui doit pouvoir écrire ici.
 */

const BUCKET = "driver-contracts";

/** Deux minutes : le temps d'ouvrir le document, pas de le faire circuler.
 *  Une URL signée longue transformerait un lien copié en accès durable à une
 *  pièce d'identité. */
const VIEW_TTL_SECONDS = 120;

/** Au-delà, on ne lit même pas le corps. Next ne plafonne pas les route
 *  handlers (le 1 Mo documenté ne concerne que les Server Actions), donc la
 *  borne est à poser ici. La marge couvre l'enrobage multipart. */
const MAX_REQUEST_BYTES = MAX_SCAN_BYTES + 1024 * 1024;

const CONTENT_TYPE_OF = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Refus avant lecture : inutile de mettre 200 Mo en mémoire pour les
  // rejeter ensuite.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop lourd. Maximum ${MAX_SCAN_BYTES / (1024 * 1024)} Mo.` },
      { status: 413 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Requête illisible : envoyez un formulaire multipart." },
      { status: 400 }
    );
  }

  const driverId = String(form.get("driver_id") ?? "").trim();
  const file = form.get("file");

  if (!driverId) {
    return NextResponse.json({ error: "driver_id manquant" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  }

  const sizeError = scanSizeError(file.size);
  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Re-contrôle après lecture : file.size vient du client, bytes.length est ce
  // qu'on tient vraiment.
  const realSizeError = scanSizeError(bytes.length);
  if (realSizeError) {
    return NextResponse.json({ error: realSizeError }, { status: 413 });
  }

  // Le type est lu dans les octets, pas dans ce que le navigateur annonce.
  const kind = sniffScanType(bytes.subarray(0, 16));
  if (!kind) {
    return NextResponse.json(
      {
        error:
          "Format non reconnu. Acceptés : PDF, JPEG, PNG, WebP. " +
          "Un HEIC d'iPhone doit être converti avant l'envoi.",
      },
      { status: 415 }
    );
  }

  // driver_identity.cin est NOT NULL : on ne peut pas créer la fiche avec le
  // seul scan, et inventer un CIN est hors de question. On le dit clairement
  // plutôt que de laisser remonter une violation de contrainte.
  const { data: existing, error: readError } = await supabaseAdmin
    .from("driver_identity")
    .select("cin, contract_legalized_at, contract_scan_path")
    .eq("driver_id", driverId)
    .maybeSingle();

  if (readError) {
    if (readError.code === "42703" || /does not exist/i.test(readError.message)) {
      return NextResponse.json(
        {
          error:
            "La base n'a pas les colonnes de dossier. Lancez " +
            "supabase/migrations/20261015103000_driver_verification_repair.sql, puis réessayez.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json(
      {
        error:
          "Renseignez d'abord le CIN : la fiche de ce livreur n'existe pas encore.",
      },
      { status: 409 }
    );
  }

  const previousPath = (existing.contract_scan_path as string | null) ?? null;
  const path = scanStoragePath(driverId, kind, Date.now());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: CONTENT_TYPE_OF[kind],
      // Jamais d'écrasement : l'horodatage rend la collision improbable, et
      // upsert: false la rend impossible à passer en silence.
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Dépôt du scan impossible : ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("driver_identity")
    .update({
      contract_scan_path: path,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    })
    .eq("driver_id", driverId);

  if (updateError) {
    // Le fichier est déposé mais la fiche ne le sait pas. On le dit, et le
    // journal garde le chemin : rien n'est perdu, et un second essai écrira
    // un nouveau chemin sans toucher à celui-ci.
    await logAudit({
      admin_id: admin.id,
      admin_email: admin.email ?? "",
      action_type: "driver_contract_scan_orphan",
      target_type: "driver",
      target_id: driverId,
      details: { path, error: updateError.message },
    });
    return NextResponse.json(
      {
        error:
          "Le fichier est déposé mais la fiche n'a pas pu être mise à jour : " +
          updateError.message,
      },
      { status: 500 }
    );
  }

  // Le dossier devient-il complet ? On le marque pour garder la trace de QUAND
  // le livreur est devenu autorisé à travailler. Le critère est celui de
  // lib/driver-verification.ts, qui dit la même chose que driver_is_verified()
  // en base — et c'est la base qui autorise réellement.
  const dossier = {
    cin: existing.cin as string | null,
    contract_legalized_at: existing.contract_legalized_at as string | null,
    contract_scan_path: path,
  };
  const complete = isDossierComplete(dossier);

  const { data: row } = await supabaseAdmin
    .from("driver_identity")
    .select("verified_at")
    .eq("driver_id", driverId)
    .maybeSingle();

  if (complete && !row?.verified_at) {
    await supabaseAdmin
      .from("driver_identity")
      .update({ verified_at: new Date().toISOString(), verified_by: admin.id })
      .eq("driver_id", driverId);
  }

  // Les chemins entrent au journal : c'est par eux qu'on retrouve la version
  // précédente d'un contrat remplacé. Ils ne contiennent que l'identifiant du
  // livreur, déjà la cible de l'entrée.
  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "",
    action_type: previousPath
      ? "driver_contract_scan_replace"
      : "driver_contract_scan_upload",
    target_type: "driver",
    target_id: driverId,
    details: {
      path,
      previous_path: previousPath,
      kind,
      bytes: bytes.length,
      now_verified: complete,
    },
  });

  return NextResponse.json({
    ok: true,
    path,
    replaced: previousPath !== null,
    verified: complete,
  });
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const driverId = req.nextUrl.searchParams.get("driver_id");
  if (!driverId) {
    return NextResponse.json({ error: "driver_id manquant" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("driver_identity")
    .select("contract_scan_path")
    .eq("driver_id", driverId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const path = (data?.contract_scan_path as string | null) ?? null;
  if (!path) {
    return NextResponse.json(
      { error: "Aucun scan déposé pour ce livreur." },
      { status: 404 }
    );
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, VIEW_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      {
        error:
          "Le scan est référencé mais introuvable dans le Stockage : " +
          (signError?.message ?? "fichier absent"),
      },
      { status: 502 }
    );
  }

  // Consulter un contrat, c'est voir une signature et une pièce d'identité :
  // on note qui a regardé quoi. Jamais l'URL signée elle-même — elle vaut
  // accès au fichier pendant sa durée de vie.
  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "",
    action_type: "driver_contract_scan_view",
    target_type: "driver",
    target_id: driverId,
    details: { path, ttl_seconds: VIEW_TTL_SECONDS },
  });

  return NextResponse.json(
    { url: signed.signedUrl, expires_in: VIEW_TTL_SECONDS },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
