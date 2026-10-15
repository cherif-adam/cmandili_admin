import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";
import { isDossierComplete } from "@/lib/driver-verification";

/**
 * Dossier de vérification d'un livreur : CIN + contrat légalisé + scan.
 *
 * Le critère a TROIS pièces depuis 20261015190000, et il est écrit une seule
 * fois, dans lib/driver-verification.ts. Le scan n'est plus facultatif : une
 * date saisie à la main n'atteste rien, c'est le document signé et tamponné
 * qui vaut preuve. Son dépôt se fait par ./scan ; cette route-ci porte le CIN
 * et les dates.
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

  // driver_identity.cin est NOT NULL. Enregistrer une date sur un livreur
  // sans fiche produisait une violation de contrainte brute, illisible, là où
  // la cause est simple à dire. On ne lit que `cin` : cette colonne existe
  // depuis la création de la table, donc ce select ne peut pas échouer sur une
  // colonne de dossier absente.
  const { data: before } = await supabaseAdmin
    .from("driver_identity")
    .select("cin")
    .eq("driver_id", driver_id)
    .maybeSingle();

  const nextCin =
    cin !== undefined ? String(cin ?? "").trim() : (before?.cin ?? "").trim();
  if (!before && !nextCin) {
    return NextResponse.json(
      { error: "Le CIN est obligatoire pour créer la fiche de ce livreur." },
      { status: 400 }
    );
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

  // Marquer la date de vérification quand les trois pièces sont là, pour
  // garder une trace de QUAND le livreur est devenu autorisé à travailler.
  const { data: row } = await supabaseAdmin
    .from("driver_identity")
    .select("cin, contract_legalized_at, contract_scan_path, verified_at")
    .eq("driver_id", driver_id)
    .maybeSingle();

  // Le critère vient du helper partagé : la page des livreurs lit le même, et
  // c'est driver_is_verified() en base qui autorise réellement.
  const complete = isDossierComplete(row);
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
