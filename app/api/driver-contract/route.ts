import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";
import {
  MAX_SCAN_BYTES,
  isDossierComplete,
  scanSizeError,
  sniffScanType,
} from "@/lib/driver-verification";
import { contractToSignPath } from "@/lib/driver-contract";

/**
 * Le contrat qui circule entre l'admin et le livreur
 * (migration 20261026120000_driver_contract_exchange.sql).
 *
 *   POST   l'admin ENVOIE le contrat à signer (PDF) au livreur
 *   GET    URL signée de deux minutes : ?driver_id=…&which=to_sign|signed
 *   PATCH  l'admin VALIDE ou REFUSE la photo renvoyée par le livreur
 *
 * Même règles que la route du scan : requireAdmin() dans chaque handler,
 * type lu dans les octets, rien n'est jamais écrasé (chemins horodatés,
 * upsert: false), chaque action au journal d'audit.
 */

const BUCKET = "driver-contracts";
const VIEW_TTL_SECONDS = 120;
const MAX_REQUEST_BYTES = MAX_SCAN_BYTES + 1024 * 1024;

/** Message dans l'appli du livreur (table notifications). Best-effort : un
 *  échec ici ne doit pas annuler l'envoi ou la validation. */
async function notifyDriver(driverId: string, title: string, message: string) {
  try {
    const { data: driver } = await supabaseAdmin
      .from("drivers")
      .select("user_id")
      .eq("id", driverId)
      .maybeSingle();
    if (!driver?.user_id) return;
    await supabaseAdmin.from("notifications").insert({
      user_id: driver.user_id,
      title,
      message,
      type: "contract",
      data: { driver_id: driverId },
    });
  } catch {
    // Best-effort
  }
}

function missingTableResponse(message: string) {
  if (/driver_contracts/.test(message) && /does not exist|schema cache/i.test(message)) {
    return NextResponse.json(
      {
        error:
          "La base n'a pas encore la table driver_contracts. Lancez " +
          "supabase/migrations/20261026120000_driver_contract_exchange.sql, puis réessayez.",
      },
      { status: 503 }
    );
  }
  return null;
}

// ── POST : envoyer le contrat à signer ──────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sizeError = scanSizeError(bytes.length);
  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 413 });
  }
  // Le contrat à signer est un PDF : c'est ce que le livreur imprime.
  if (sniffScanType(bytes.subarray(0, 16)) !== "pdf") {
    return NextResponse.json(
      { error: "Le contrat à envoyer doit être un PDF." },
      { status: 415 }
    );
  }

  const path = contractToSignPath(driverId, Date.now());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    return NextResponse.json(
      { error: `Envoi impossible : ${uploadError.message}` },
      { status: 500 }
    );
  }

  // Un nouvel envoi repart de zéro : la photo d'un ancien contrat ne vaut pas
  // signature du nouveau.
  const { error: rowError } = await supabaseAdmin.from("driver_contracts").upsert(
    {
      driver_id: driverId,
      to_sign_path: path,
      sent_at: new Date().toISOString(),
      sent_by: admin.id,
      signed_path: null,
      submitted_at: null,
      status: "sent",
      admin_note: null,
      reviewed_at: null,
      reviewed_by: null,
    },
    { onConflict: "driver_id" }
  );
  if (rowError) {
    return (
      missingTableResponse(rowError.message) ??
      NextResponse.json({ error: rowError.message }, { status: 500 })
    );
  }

  await notifyDriver(
    driverId,
    "Votre contrat Amana est prêt",
    "Ouvrez Profil > Mon contrat : téléchargez-le, signez-le, faites légaliser la signature à la baladiya, puis renvoyez-en la photo."
  );

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "",
    action_type: "driver_contract_send",
    target_type: "driver",
    target_id: driverId,
    details: { path, bytes: bytes.length },
  });

  return NextResponse.json({ ok: true, path });
}

// ── GET : ouvrir le contrat envoyé ou la photo renvoyée ────────────────────

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const driverId = req.nextUrl.searchParams.get("driver_id");
  const which = req.nextUrl.searchParams.get("which");
  if (!driverId || (which !== "to_sign" && which !== "signed")) {
    return NextResponse.json(
      { error: "driver_id et which=to_sign|signed requis" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("driver_contracts")
    .select("to_sign_path, signed_path")
    .eq("driver_id", driverId)
    .maybeSingle();
  if (error) {
    return (
      missingTableResponse(error.message) ??
      NextResponse.json({ error: error.message }, { status: 500 })
    );
  }

  const path =
    (which === "to_sign" ? data?.to_sign_path : data?.signed_path) ?? null;
  if (!path) {
    return NextResponse.json({ error: "Aucun fichier." }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, VIEW_TTL_SECONDS);
  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Fichier introuvable dans le Stockage." },
      { status: 502 }
    );
  }

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "",
    action_type: "driver_contract_view",
    target_type: "driver",
    target_id: driverId,
    details: { path, which, ttl_seconds: VIEW_TTL_SECONDS },
  });

  return NextResponse.json(
    { url: signed.signedUrl, expires_in: VIEW_TTL_SECONDS },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

// ── PATCH : valider ou refuser la photo du livreur ─────────────────────────

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { driver_id?: string; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const driverId = (body.driver_id ?? "").trim();
  const action = body.action;
  const note = (body.note ?? "").trim();
  if (!driverId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json(
      { error: "driver_id et action=approve|reject requis" },
      { status: 400 }
    );
  }

  const { data: contract, error: readError } = await supabaseAdmin
    .from("driver_contracts")
    .select("status, signed_path")
    .eq("driver_id", driverId)
    .maybeSingle();
  if (readError) {
    return (
      missingTableResponse(readError.message) ??
      NextResponse.json({ error: readError.message }, { status: 500 })
    );
  }
  if (!contract?.signed_path || contract.status !== "submitted") {
    return NextResponse.json(
      { error: "Aucune photo de contrat signée à vérifier pour ce livreur." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  if (action === "reject") {
    if (!note) {
      return NextResponse.json(
        { error: "Indiquez le motif du refus : le livreur le verra." },
        { status: 400 }
      );
    }
    const { error } = await supabaseAdmin
      .from("driver_contracts")
      .update({ status: "rejected", admin_note: note, reviewed_at: now, reviewed_by: admin.id })
      .eq("driver_id", driverId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await notifyDriver(
      driverId,
      "Contrat à renvoyer",
      `Votre contrat a été refusé : ${note}. Renvoyez-en une photo depuis Profil > Mon contrat.`
    );
    await logAudit({
      admin_id: admin.id,
      admin_email: admin.email ?? "",
      action_type: "driver_contract_reject",
      target_type: "driver",
      target_id: driverId,
      details: { path: contract.signed_path, note },
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // Valider : la photo devient le scan du dossier. La fiche (CIN) doit
  // exister — driver_identity.cin est NOT NULL, on n'en invente pas.
  const { data: identity, error: identError } = await supabaseAdmin
    .from("driver_identity")
    .select("cin, contract_legalized_at, contract_scan_path, verified_at")
    .eq("driver_id", driverId)
    .maybeSingle();
  if (identError) {
    return NextResponse.json({ error: identError.message }, { status: 500 });
  }
  if (!identity) {
    return NextResponse.json(
      { error: "Renseignez d'abord le CIN du livreur, puis validez." },
      { status: 409 }
    );
  }

  const { error: identUpdateError } = await supabaseAdmin
    .from("driver_identity")
    .update({
      contract_scan_path: contract.signed_path,
      updated_at: now,
      updated_by: admin.id,
    })
    .eq("driver_id", driverId);
  if (identUpdateError) {
    return NextResponse.json({ error: identUpdateError.message }, { status: 500 });
  }

  const complete = isDossierComplete({
    cin: identity.cin as string | null,
    contract_legalized_at: identity.contract_legalized_at as string | null,
    contract_scan_path: contract.signed_path as string,
  });
  if (complete && !identity.verified_at) {
    await supabaseAdmin
      .from("driver_identity")
      .update({ verified_at: now, verified_by: admin.id })
      .eq("driver_id", driverId);
  }

  const { error: approveError } = await supabaseAdmin
    .from("driver_contracts")
    .update({ status: "approved", admin_note: null, reviewed_at: now, reviewed_by: admin.id })
    .eq("driver_id", driverId);
  if (approveError) {
    return NextResponse.json({ error: approveError.message }, { status: 500 });
  }

  await notifyDriver(
    driverId,
    "Contrat validé",
    complete
      ? "Votre contrat est validé. Vous pouvez travailler."
      : "Votre contrat est validé. L'équipe Amana finalise votre dossier."
  );
  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "",
    action_type: "driver_contract_approve",
    target_type: "driver",
    target_id: driverId,
    details: {
      path: contract.signed_path,
      previous_scan_path: identity.contract_scan_path ?? null,
      now_verified: complete,
    },
  });

  return NextResponse.json({ ok: true, status: "approved", verified: complete });
}
