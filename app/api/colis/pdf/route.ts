import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";
import {
  buildColisReceiptPdf,
  pdfFileName,
  receiptFingerprint,
  type ColisReceiptRecord,
  type ReceiptPhotos,
} from "@/lib/colis-receipt-pdf";

/**
 * Bon de prise en charge Colis — export PDF, administrateurs uniquement.
 *
 * Le document sert de preuve devant un service client, un assureur ou un
 * dépôt de plainte : il rassemble les deux photos, les heures serveur, les
 * positions, l'identité figée du livreur (CIN comprise) et les litiges.
 *
 * requireAdmin() est revérifié ICI, dans le handler. Le proxy protège les
 * pages, mais une route API répond directement à qui connaît son URL, et
 * celle-ci rend un document contenant un numéro de CIN — c'est la seule
 * barrière qui compte. Même raisonnement que la clôture forcée dans
 * ../route.ts.
 *
 * Les photos sont téléchargées côté serveur depuis le bucket PRIVÉ et
 * intégrées aux octets du PDF. Aucune URL signée n'entre dans le document :
 * elle expirerait, et surtout elle transformerait le PDF en jeton d'accès au
 * bucket pour quiconque le reçoit. Le PDF n'est pas stocké, il est streamé.
 *
 * GET /api/colis/pdf?order_id=<uuid>
 */

/** Bucket privé des preuves. Jamais rendu public, jamais signé ici. */
const PROOF_BUCKET = "colis-proofs";

/** Au-delà, on n'intègre pas : un PDF de preuve doit rester transmissible. */
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function detectFormat(path: string | null): "JPEG" | "PNG" {
  return path && /\.png$/i.test(path) ? "PNG" : "JPEG";
}

/**
 * Télécharge une preuve et la rend en base64.
 *
 * Renvoie null plutôt que de lever : une photo manquante ou illisible est une
 * information que le bon doit porter (« Non enregistré »), pas une raison de
 * priver l'admin du reste du dossier au moment où il en a besoin.
 */
async function fetchPhoto(
  path: string | null,
): Promise<ReceiptPhotos["pickup"]> {
  if (!path) return null;
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(PROOF_BUCKET)
      .download(path);
    if (error || !data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_PHOTO_BYTES) return null;
    return { base64: buf.toString("base64"), format: detectFormat(path) };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orderId = req.nextUrl.searchParams.get("order_id");
  if (!orderId) {
    return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
  }

  const { data: receipt, error } = await supabaseAdmin
    .from("colis_receipts")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!receipt) {
    return NextResponse.json({ error: "Bon introuvable" }, { status: 404 });
  }

  // Le CIN vit dans une table séparée à RLS admin-only, figée à la prise en
  // charge. Il n'est joignable depuis aucune ligne que l'expéditeur ou le
  // livreur peut lire, et il ne sort d'ici que dans ce PDF.
  const [{ data: identity }, { data: order }, { data: disputes }] =
    await Promise.all([
      supabaseAdmin
        .from("colis_receipt_identity")
        .select("driver_cin")
        .eq("order_id", orderId)
        .maybeSingle(),
      supabaseAdmin
        .from("orders")
        .select(
          "id, status, created_at, pickup_address, delivery_address, recipient_name, recipient_phone, sender_phone",
        )
        .eq("id", orderId)
        .maybeSingle(),
      supabaseAdmin
        .from("colis_disputes")
        .select("created_at, kind, message")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
    ]);

  // Téléphone du livreur : profiles via drivers.user_id. C'est le numéro
  // ACTUEL — le bon ne fige que le nom et la plaque — et le PDF le dit.
  let driverPhone: string | null = null;
  if (receipt.driver_id) {
    const { data: driver } = await supabaseAdmin
      .from("drivers")
      .select("user_id")
      .eq("id", receipt.driver_id)
      .maybeSingle();
    if (driver?.user_id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .eq("id", driver.user_id)
        .maybeSingle();
      driverPhone = profile?.phone ?? null;
    }
  }

  // Qui a signé la clôture forcée, par e-mail plutôt que par UUID : un UUID
  // ne désigne personne dans un dossier de litige.
  let overrideAdmin: string | null = null;
  if (receipt.admin_override_by) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", receipt.admin_override_by)
      .maybeSingle();
    overrideAdmin = profile?.email ?? profile?.full_name ?? null;
  }

  const record: ColisReceiptRecord = {
    order: {
      id: orderId,
      created_at: order?.created_at ?? null,
      status: order?.status ?? null,
      delivery_mode: receipt.delivery_mode,
      receiver_label: receipt.receiver_label ?? null,
      no_code_accepted_at: receipt.no_code_accepted_at ?? null,
    },
    sender: {
      name: receipt.sender_name ?? null,
      phone: receipt.sender_phone ?? order?.sender_phone ?? null,
      address: order?.pickup_address ?? null,
    },
    recipient: {
      name: order?.recipient_name ?? null,
      phone: order?.recipient_phone ?? null,
      address: order?.delivery_address ?? null,
    },
    driver: {
      name: receipt.driver_name ?? null,
      phone: driverPhone,
      cin: identity?.driver_cin ?? null,
      plate: receipt.driver_plate ?? null,
    },
    parcel: {
      description: receipt.description ?? null,
      declared_value:
        receipt.declared_value === null || receipt.declared_value === undefined
          ? null
          : Number(receipt.declared_value),
    },
    pickup: {
      at: receipt.pickup_at ?? null,
      lat: receipt.pickup_lat ?? null,
      lng: receipt.pickup_lng ?? null,
      confirmed: receipt.pickup_at !== null,
    },
    delivery: {
      at: receipt.delivery_at ?? null,
      lat: receipt.delivery_lat ?? null,
      lng: receipt.delivery_lng ?? null,
      distance_m: receipt.delivery_distance_m ?? null,
      code_verified: receipt.code_verified ?? null,
    },
    override: {
      at: receipt.admin_override_at ?? null,
      reason: receipt.admin_override_reason ?? null,
      admin: overrideAdmin,
    },
    // status / resolution n'existent pas encore sur colis_disputes : le bon
    // les imprime « Non enregistré » plutôt que de les inventer.
    disputes: (disputes ?? []).map((d) => ({
      created_at: d.created_at ?? null,
      kind: d.kind ?? null,
      status: null,
      resolution: null,
      message: d.message ?? null,
    })),
  };

  const photos: ReceiptPhotos = {
    pickup: await fetchPhoto(receipt.pickup_photo_path ?? null),
    delivery: await fetchPhoto(receipt.delivery_photo_path ?? null),
  };

  const generatedAt = new Date().toISOString();
  const bytes = buildColisReceiptPdf(record, photos, {
    generatedAt,
    generatedByEmail: admin.email ?? admin.id,
  });

  // L'export est journalisé : savoir qui a sorti une pièce contenant un CIN
  // fait partie du dossier. La VALEUR du CIN, elle, n'entre pas dans le
  // journal — le journal est lisible par tout admin et n'a pas à le diffuser
  // une seconde fois. On note seulement qu'il était présent.
  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "",
    action_type: "colis_receipt_pdf_export",
    target_type: "order",
    target_id: orderId,
    details: {
      fingerprint: receiptFingerprint(record),
      cin_included: identity?.driver_cin ? true : false,
      pickup_photo_embedded: photos.pickup !== null,
      delivery_photo_embedded: photos.delivery !== null,
    },
  });

  return new NextResponse(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      // Téléchargement uniquement : rien n'est écrit dans un bucket.
      "Content-Disposition": `attachment; filename="${pdfFileName(orderId, generatedAt)}"`,
      // Une pièce nominative ne se met pas en cache côté proxy.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
