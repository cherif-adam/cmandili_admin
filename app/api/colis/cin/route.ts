import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

/**
 * CIN figé sur UN bon de prise en charge — administrateurs seuls.
 *
 * GET /api/colis/cin?order_id=<uuid>
 *
 * POURQUOI UNE ROUTE À PART. Le CIN était auparavant joint à chaque ligne de
 * la liste : charger la page envoyait jusqu'à 200 numéros de pièce d'identité
 * au navigateur, dont 199 que personne ne regardait. Il ne voyage plus en
 * lot — un admin qui déplie un bon précis demande ce bon précis, et cette
 * consultation est inscrite au journal.
 *
 * requireAdmin() est revérifié ici : c'est la seule barrière qui compte sur
 * une route qui rend un numéro de pièce d'identité.
 *
 * colis_receipt_identity est admin-only en RLS et fige le CIN par commande.
 * À ne pas confondre avec driver_identity, qui porte le CIN COURANT du
 * livreur : ce qu'un bon doit attester, c'est qui a pris le colis ce jour-là.
 */

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orderId = req.nextUrl.searchParams.get("order_id");
  if (!orderId) {
    return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("colis_receipt_identity")
    .select("driver_cin")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cin = (data?.driver_cin as string | null) ?? null;

  // La VALEUR du CIN n'entre pas dans le journal : le journal est lisible par
  // tout admin et n'a pas à la diffuser une seconde fois. On note qui a
  // regardé quel bon, et si le bon en portait un.
  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "",
    action_type: "colis_receipt_cin_view",
    target_type: "order",
    target_id: orderId,
    details: { cin_present: cin !== null },
  });

  return NextResponse.json(
    { cin },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
