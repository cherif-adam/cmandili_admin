import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

/**
 * Dossier de vérification d'un livreur : CIN + contrat signé et légalisé.
 *
 * Le critère de vérification est le CIN ET la date de légalisation. Le scan du
 * contrat est facultatif — c'est une pièce jointe, pas la preuve.
 *
 * requireAdmin() est revérifié ici : une route API est joignable par POST
 * direct, s'en remettre au proxy laisserait la porte ouverte à qui connaît
 * l'URL.
 *
 * driver_identity est admin-only en RLS ; supabaseAdmin (service_role) la
 * traverse, et c'est voulu : c'est exactement le rôle qui doit pouvoir écrire
 * ce dossier.
 */

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { driver_id, cin, contract_legalized_at, contract_signed_at } =
    await req.json();

  if (!driver_id) {
    return NextResponse.json({ error: "driver_id manquant" }, { status: 400 });
  }

  // Champs optionnels un par un : l'admin saisit souvent le CIN d'abord, le
  // contrat plus tard, quand le livreur revient de la baladiya.
  const patch: Record<string, unknown> = {
    driver_id,
    updated_at: new Date().toISOString(),
    updated_by: admin.id,
  };
  if (cin !== undefined) patch.cin = String(cin).trim() || null;
  if (contract_legalized_at !== undefined) {
    patch.contract_legalized_at = contract_legalized_at || null;
  }
  if (contract_signed_at !== undefined) {
    patch.contract_signed_at = contract_signed_at || null;
  }

  const { error } = await supabaseAdmin
    .from("driver_identity")
    .upsert(patch, { onConflict: "driver_id" });

  if (error) {
    // 42703 = la colonne n'existe pas. C'est arrivé : 20261015090000 a
    // rapporté Success sans que ses colonnes de dossier soient en place, et
    // l'admin aurait vu une erreur Postgres brute, illisible, en essayant
    // d'enregistrer un contrat. On nomme la cause et le remède.
    if (error.code === "42703" || /does not exist/i.test(error.message)) {
      return NextResponse.json(
        {
          error:
            "La base n'a pas les colonnes de dossier (contrat, vérification). " +
            "Lancez supabase/migrations/20261015103000_driver_verification_repair.sql, " +
            "puis réessayez.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Marquer la date de vérification quand les deux pièces sont là, pour
  // garder une trace de QUAND le livreur est devenu autorisé à travailler.
  const { data: row } = await supabaseAdmin
    .from("driver_identity")
    .select("cin, contract_legalized_at, verified_at")
    .eq("driver_id", driver_id)
    .maybeSingle();

  const complete = Boolean(row?.cin && row?.contract_legalized_at);
  if (complete && !row?.verified_at) {
    await supabaseAdmin
      .from("driver_identity")
      .update({ verified_at: new Date().toISOString(), verified_by: admin.id })
      .eq("driver_id", driver_id);
  }

  // Le journal d'audit enregistre CE QUI a été renseigné, jamais la valeur du
  // CIN : le journal est consulté bien plus largement que la table qui porte
  // la donnée.
  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "",
    action_type: "driver_verification_update",
    target_type: "driver",
    target_id: driver_id,
    details: {
      cin_set: cin !== undefined ? Boolean(String(cin ?? "").trim()) : undefined,
      contract_legalized_at: contract_legalized_at ?? undefined,
      now_verified: complete,
    },
  });

  return NextResponse.json({ ok: true, verified: complete });
}
