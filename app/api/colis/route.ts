import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Bon de prise en charge Colis — actions administrateur.
 *
 * Deux choses, et deux seulement :
 *   POST   clôture forcée d'une livraison bloquée (motif obligatoire)
 *   PATCH  saisie du CIN d'un livreur, à son intégration
 *
 * Chaque handler revérifie requireAdmin() pour lui-même. Le proxy protège déjà
 * les pages, mais une route API est joignable directement en POST : s'en
 * remettre au proxy seul laisserait la porte ouverte à qui connaît l'URL.
 *
 * Les deux écritures passent par les tables à RLS admin-only et par la RPC
 * colis_admin_force_close, qui exige le motif côté base. Le contrôle fait ici
 * évite un aller-retour inutile ; c'est celui de la base qui fait foi.
 */

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { order_id, reason } = await req.json();
  if (!order_id) {
    return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
  }
  if (!reason || !String(reason).trim()) {
    return NextResponse.json(
      { error: "Un motif écrit est obligatoire" },
      { status: 400 }
    );
  }

  // Client scopé à l'admin connecté, PAS supabaseAdmin.
  //
  // La RPC lit auth.uid() deux fois : pour vérifier is_admin, et pour
  // enregistrer qui a clôturé dans admin_override_by. Appelée avec la clé
  // service_role il n'y a pas de JWT, donc auth.uid() vaut NULL : le contrôle
  // échouerait systématiquement et, s'il passait, la preuve ne dirait pas qui
  // a signé. Le cookie de session porte l'identité réelle.
  const userScoped = await createSupabaseServerClient();
  const { error } = await userScoped.rpc("colis_admin_force_close", {
    p_order_id: order_id,
    p_reason: String(reason).trim(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "",
    action_type: "colis_force_close",
    target_type: "order",
    target_id: order_id,
    details: { reason: String(reason).trim() },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { driver_id, cin } = await req.json();
  if (!driver_id || !cin || !String(cin).trim()) {
    return NextResponse.json(
      { error: "driver_id et cin sont obligatoires" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from("driver_identity").upsert(
    {
      driver_id,
      cin: String(cin).trim(),
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    },
    { onConflict: "driver_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Le CIN lui-même n'entre PAS dans le journal d'audit : c'est une donnée
  // d'identité, et le journal est consulté bien plus largement que la table
  // qui la porte. On trace qui a renseigné quoi, pas la valeur.
  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "",
    action_type: "driver_cin_set",
    target_type: "driver",
    target_id: driver_id,
  });

  return NextResponse.json({ ok: true });
}
