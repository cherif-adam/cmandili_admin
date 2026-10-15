import { supabaseAdmin } from "./supabase-admin";
import {
  dayEndIso,
  dayStartIso,
  hasFilters,
  rowMatchesQuery,
  type ColisReceiptListRow,
  type ColisSearchFilters,
  type ColisSearchResult,
} from "./colis-search";

/**
 * Bons de prise en charge Colis — lecture de la liste, côté serveur.
 *
 * Un seul chemin de données pour la page ET pour la recherche : la page rend
 * la vue par défaut avec cette fonction, la route /api/colis/search la rappelle
 * avec des filtres. Deux implémentations auraient fini par divergir, et c'est
 * alors la recherche — celle qu'on utilise sous pression — qui aurait menti.
 *
 * TROIS CHOIX QUI COMPTENT :
 *
 *   1. LE CIN N'EST PAS DANS CETTE LISTE. Il vit dans colis_receipt_identity
 *      (RLS admin-only) et ne sort que par /api/colis/cin, un bon à la fois et
 *      journalisé, ou dans le PDF. Avant, 200 numéros de CIN partaient au
 *      navigateur au simple chargement de la page ; maintenant, aucun.
 *
 *   2. ON FILTRE AVANT DE SIGNER. Les URL de photos sont signées en dernier,
 *      sur les seules lignes retenues. La recherche se déclenche à la frappe :
 *      signer la fenêtre entière à chaque lettre, c'était des centaines
 *      d'appels Storage par mot tapé.
 *
 *   3. LA FENÊTRE D'EXAMEN EST BORNÉE ET LE DIT. Le serveur examine au plus
 *      SCAN_LIMIT bons ; au-delà, `truncated` remonte jusqu'à l'interface. Une
 *      recherche tronquée en silence, sur une réquisition, ferait déclarer
 *      introuvable un colis qui existe.
 *
 * Les filtres de date partent en SQL (c'est ce que SQL fait bien et c'est le
 * seul critère qui réduit vraiment le volume). Le reste — numéro normalisé,
 * identifiant court, nom sans accents — n'est pas exprimable via PostgREST et
 * se joue dans colis-search.ts, qui est testé.
 */

/** Nombre de bons que le serveur examine au plus. */
export const SCAN_LIMIT = 2000;

/** Nombre de bons renvoyés au navigateur. Reprend le plafond historique de la
 *  page : on examine large, on affiche ce qui est lisible. */
export const PAGE_LIMIT = 200;

/** Une heure : largement la durée d'un examen de litige. */
const SIGNED_URL_TTL = 3600;

/** Bucket privé des preuves. Jamais rendu public. */
const PROOF_BUCKET = "colis-proofs";

export class ColisSearchInputError extends Error {}

interface OrderRow {
  id: string;
  status: string | null;
  user_id: string | null;
  driver_id: string | null;
  delivered_at: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  sender_phone: string | null;
}

/**
 * Signe un lot de chemins en un seul appel.
 *
 * `createSignedUrls` plutôt que N × `createSignedUrl` : la version unitaire
 * faisait deux allers-retours Storage par ligne, soit 400 pour une page
 * pleine, avant même qu'on ait ajouté la recherche.
 *
 * Un chemin illisible rend null : une photo manquante est une information que
 * le bon doit porter, pas une raison de priver l'admin du reste du dossier.
 */
async function signAll(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter((p) => p))];
  if (!unique.length) return out;

  const { data, error } = await supabaseAdmin.storage
    .from(PROOF_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL);
  if (error || !data) return out;

  for (const entry of data) {
    if (entry.path && entry.signedUrl && !entry.error) {
      out.set(entry.path, entry.signedUrl);
    }
  }
  return out;
}

/**
 * Lit les bons, applique les filtres, renvoie la page.
 *
 * @throws ColisSearchInputError si une borne de date n'est pas une date.
 */
export async function fetchColisReceipts(
  filters: ColisSearchFilters = {}
): Promise<ColisSearchResult> {
  const from = filters.from?.trim() || null;
  const to = filters.to?.trim() || null;

  // Une borne illisible n'est pas ignorée en silence : l'admin croirait que
  // sa période ne contient rien.
  const fromIso = from ? dayStartIso(from) : null;
  const toIso = to ? dayEndIso(to) : null;
  if (from && !fromIso) {
    throw new ColisSearchInputError(`Date de début invalide : ${from}`);
  }
  if (to && !toIso) {
    throw new ColisSearchInputError(`Date de fin invalide : ${to}`);
  }

  let query = supabaseAdmin
    .from("colis_receipts")
    .select("*")
    .order("created_at", { ascending: false })
    // +1 pour savoir si la fenêtre a été atteinte, sans second comptage.
    .limit(SCAN_LIMIT + 1);
  if (fromIso) query = query.gte("created_at", fromIso);
  if (toIso) query = query.lte("created_at", toIso);

  const { data: scanned, error } = await query;
  if (error) throw error;

  const truncated = (scanned?.length ?? 0) > SCAN_LIMIT;
  const receipts = (scanned ?? []).slice(0, SCAN_LIMIT);
  if (!receipts.length) return { rows: [], matched: 0, truncated };

  const orderIds = receipts.map((r) => r.order_id as string);

  const [ordersRes, disputesRes] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select(
        "id, status, user_id, driver_id, delivered_at, recipient_name, recipient_phone, sender_phone"
      )
      .in("id", orderIds),
    supabaseAdmin
      .from("colis_disputes")
      .select("order_id, user_id, driver_id, kind, created_at"),
  ]);

  const orderOf = new Map<string, OrderRow>(
    ((ordersRes.data ?? []) as OrderRow[]).map((o) => [o.id, o])
  );

  // Le livreur est cherché via colis_receipts.driver_id si le bon l'a figé,
  // sinon via orders.driver_id. C'est le cas d'un bon posé par une ancienne
  // APK : il n'a rien figé, mais la commande sait qui a livré. Même
  // raisonnement que l'export PDF.
  const driverIds = new Set<string>();
  for (const r of receipts) {
    const id = (r.driver_id as string | null) ?? orderOf.get(r.order_id as string)?.driver_id;
    if (id) driverIds.add(id);
  }

  const { data: driverRows } = driverIds.size
    ? await supabaseAdmin
        .from("drivers")
        .select("id, user_id")
        .in("id", [...driverIds])
    : { data: [] as { id: string; user_id: string }[] };

  const driverUserOf = new Map<string, string>(
    (driverRows ?? []).map((d) => [d.id, d.user_id])
  );

  // Un seul passage sur profiles pour les expéditeurs ET les livreurs.
  const profileIds = new Set<string>();
  for (const uid of driverUserOf.values()) profileIds.add(uid);
  for (const o of orderOf.values()) if (o.user_id) profileIds.add(o.user_id);

  const { data: profileRows } = profileIds.size
    ? await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", [...profileIds])
    : { data: [] as { id: string; full_name: string | null; phone: string | null }[] };

  const profileOf = new Map(
    (profileRows ?? []).map((p) => [p.id, p])
  );

  // Compteurs de litiges, par client et par livreur. Un seul passage sur la
  // table : la volumétrie ne justifie pas une vue agrégée.
  const byUser: Record<string, number> = {};
  const byDriver: Record<string, number> = {};
  const byOrder: Record<string, number> = {};
  for (const d of disputesRes.data ?? []) {
    if (d.user_id) byUser[d.user_id] = (byUser[d.user_id] ?? 0) + 1;
    if (d.driver_id) byDriver[d.driver_id] = (byDriver[d.driver_id] ?? 0) + 1;
    if (d.order_id) byOrder[d.order_id] = (byOrder[d.order_id] ?? 0) + 1;
  }

  const built: (ColisReceiptListRow & {
    _pickup_path: string | null;
    _delivery_path: string | null;
  })[] = receipts.map((r) => {
    const order = orderOf.get(r.order_id as string) ?? null;
    const driverId = (r.driver_id as string | null) ?? order?.driver_id ?? null;
    const driverProfile = driverId
      ? profileOf.get(driverUserOf.get(driverId) ?? "") ?? null
      : null;
    const senderProfile = order?.user_id
      ? profileOf.get(order.user_id) ?? null
      : null;

    // Le nom figé fait foi. S'il n'a jamais été figé, on affiche le nom
    // courant en le signalant plutôt que de taire ce qu'on sait — et il reste
    // cherchable, sinon le livreur serait introuvable par son nom.
    const frozenDriverName = (r.driver_name as string | null) ?? null;
    const driverName = frozenDriverName ?? driverProfile?.full_name ?? null;
    const frozenSenderName = (r.sender_name as string | null) ?? null;
    const senderName = frozenSenderName ?? senderProfile?.full_name ?? null;

    return {
      order_id: r.order_id as string,
      sender_name: senderName,
      sender_name_is_current: frozenSenderName === null && senderName !== null,
      sender_phone: (r.sender_phone as string | null) ?? order?.sender_phone ?? null,
      recipient_name: order?.recipient_name ?? null,
      recipient_phone: order?.recipient_phone ?? null,
      driver_id: driverId,
      driver_name: driverName,
      driver_name_is_current: frozenDriverName === null && driverName !== null,
      // Jamais figé : le bon ne recopie pas le numéro du livreur. C'est donc
      // le numéro COURANT, et il sert surtout à le joindre.
      driver_phone: driverProfile?.phone ?? null,
      driver_plate: (r.driver_plate as string | null) ?? null,
      description: (r.description as string | null) ?? null,
      declared_value:
        r.declared_value === null || r.declared_value === undefined
          ? null
          : Number(r.declared_value),
      delivery_mode: (r.delivery_mode as string) ?? "code",
      receiver_label: (r.receiver_label as string | null) ?? null,
      no_code_accepted_at: (r.no_code_accepted_at as string | null) ?? null,
      code_attempts: (r.code_attempts as number) ?? 0,
      code_locked_at: (r.code_locked_at as string | null) ?? null,
      pickup_at: (r.pickup_at as string | null) ?? null,
      pickup_lat: (r.pickup_lat as number | null) ?? null,
      pickup_lng: (r.pickup_lng as number | null) ?? null,
      pickup_url: null,
      delivery_at: (r.delivery_at as string | null) ?? null,
      delivery_lat: (r.delivery_lat as number | null) ?? null,
      delivery_lng: (r.delivery_lng as number | null) ?? null,
      delivery_distance_m: (r.delivery_distance_m as number | null) ?? null,
      delivery_url: null,
      code_verified: (r.code_verified as boolean | null) ?? null,
      admin_override_reason: (r.admin_override_reason as string | null) ?? null,
      admin_override_at: (r.admin_override_at as string | null) ?? null,
      proof_status: (r.proof_status as string) ?? "pending",
      order_status: order?.status ?? null,
      delivered_at: order?.delivered_at ?? null,
      created_at: (r.created_at as string | null) ?? null,
      disputes_on_order: byOrder[r.order_id as string] ?? 0,
      disputes_by_customer: order?.user_id ? byUser[order.user_id] ?? 0 : 0,
      disputes_by_driver: driverId ? byDriver[driverId] ?? 0 : 0,
      _pickup_path: (r.pickup_photo_path as string | null) ?? null,
      _delivery_path: (r.delivery_photo_path as string | null) ?? null,
    };
  });

  const matching = hasFilters(filters)
    ? built.filter((row) => rowMatchesQuery(row, filters.q))
    : built;

  const page = matching.slice(0, PAGE_LIMIT);

  const signed = await signAll(
    page.flatMap((r) =>
      [r._pickup_path, r._delivery_path].filter((p): p is string => Boolean(p))
    )
  );

  const rows: ColisReceiptListRow[] = page.map((r) => {
    const { _pickup_path, _delivery_path, ...rest } = r;
    return {
      ...rest,
      pickup_url: _pickup_path ? signed.get(_pickup_path) ?? null : null,
      delivery_url: _delivery_path ? signed.get(_delivery_path) ?? null : null,
    };
  });

  return { rows, matched: matching.length, truncated };
}
