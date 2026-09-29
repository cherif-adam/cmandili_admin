import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

/**
 * Arrête une promotion d'article : les lignes visées reviennent à leur prix
 * normal.
 *
 * Les cinq colonnes de remise sont vidées ensemble. En laisser une — le taux,
 * par exemple — ferait repartir la promotion à la minute suivante : le cron
 * activate_scheduled_promotions repose le prix dès qu'il voit un taux sans
 * prix et une fenêtre ouverte.
 *
 * Une seule action possible depuis l'administration, et c'est voulu : l'admin
 * intervient pour stopper une remise abusive ou erronée, pas pour en poser une
 * à la place du commerçant, qui seul connaît sa marge.
 */
export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const ids: unknown = body?.item_ids;

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
    return NextResponse.json(
      { error: "item_ids doit être une liste de 1 à 500 identifiants" },
      { status: 400 }
    );
  }
  const itemIds = ids.filter((v): v is string => typeof v === "string" && v.length > 0);
  if (itemIds.length !== ids.length) {
    return NextResponse.json({ error: "item_ids contient une valeur invalide" }, { status: 400 });
  }

  // On relit ce qu'on s'apprête à arrêter, AVANT de l'effacer : sans cela le
  // journal d'audit ne garderait que des identifiants, et personne ne pourrait
  // dire six mois plus tard quelle remise a été coupée ni de combien.
  const { data: before } = await supabaseAdmin
    .from("vendor_items")
    .select("id, name, vendor_id, discount_price, discount_percent, discount_end_time")
    .in("id", itemIds);

  const { data: cleared, error } = await supabaseAdmin
    .from("vendor_items")
    .update({
      discount_price: null,
      discount_percent: null,
      discount_start_time: null,
      discount_end_time: null,
      discount_quantity: null,
    })
    .in("id", itemIds)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: user.id,
    admin_email: user.email ?? "unknown",
    action_type: "stop_promotion",
    target_type: "vendor_items",
    details: {
      stopped: cleared?.length ?? 0,
      items: (before ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        vendor_id: b.vendor_id,
        discount_price: b.discount_price,
        discount_percent: b.discount_percent,
        discount_end_time: b.discount_end_time,
      })),
    },
  });

  return NextResponse.json({ ok: true, stopped: cleared?.length ?? 0 });
}
