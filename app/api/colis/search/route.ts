import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/audit";
import {
  ColisSearchInputError,
  fetchColisReceipts,
} from "@/lib/colis-receipts-query";
import { rangeIsBackwards } from "@/lib/colis-search";

/**
 * Recherche dans les bons de prise en charge Colis — administrateurs seuls.
 *
 * GET /api/colis/search?q=<texte>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
 *
 * requireAdmin() est revérifié ICI. Le proxy protège déjà /api/*, mais cette
 * route permet de retrouver un colis par le numéro de téléphone de son
 * expéditeur : c'est un index de personnes, et la barrière qui compte est
 * celle du handler. Même raisonnement que l'export PDF.
 *
 * Le filtrage est fait côté serveur, de bout en bout : le navigateur ne reçoit
 * que les lignes retenues. Envoyer la liste entière puis filtrer dans la page
 * aurait signifié expédier tous les numéros de la plateforme à chaque
 * chargement.
 *
 * LE CIN N'EST NI CHERCHABLE NI RENVOYÉ. Un admin qui en a besoin ouvre un bon
 * précis (/api/colis/cin, journalisé) ou télécharge le PDF.
 *
 * Pas de journal d'audit ici : la recherche se déclenche à la frappe, et
 * inscrire chaque lettre noierait audit_logs au point de rendre illisibles les
 * écritures qui comptent. Ce qui est journalisé, c'est la consultation d'un
 * CIN et l'export d'un bon.
 */

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  if (rangeIsBackwards(from, to)) {
    return NextResponse.json(
      { error: "La date de début est postérieure à la date de fin." },
      { status: 400 }
    );
  }

  try {
    const result = await fetchColisReceipts({ q, from, to });
    return NextResponse.json(result, {
      // Une liste nominative ne se met pas en cache, ni côté proxy ni côté
      // navigateur.
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e) {
    if (e instanceof ColisSearchInputError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Recherche impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
