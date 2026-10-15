"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarRange,
  Eye,
  FileDown,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  ShieldX,
  X,
} from "lucide-react";
import {
  hasFilters,
  type ColisReceiptListRow,
  type ColisSearchResult,
} from "@/lib/colis-search";

/**
 * Bons de prise en charge Colis — liste, recherche et clôture forcée.
 *
 * LA RECHERCHE EST SERVEUR. La frappe part vers /api/colis/search, derrière
 * requireAdmin(), et seules les lignes retenues reviennent. Filtrer ici
 * aurait voulu dire expédier au navigateur tous les numéros de téléphone de
 * la plateforme à chaque chargement de page.
 *
 * Sans aucun filtre, rien n'est demandé : on réaffiche la vue rendue par le
 * serveur avec la page. Vider le champ est donc instantané.
 *
 * LE CIN N'EST PAS DANS LA LISTE. Il se demande bon par bon, sur un clic
 * explicite, et chaque consultation est inscrite au journal d'audit. Un
 * bouton plutôt qu'un affichage automatique à l'ouverture : sinon le journal
 * se remplirait de consultations que personne n'a voulues, et une ligne
 * « a consulté un CIN » ne voudrait plus rien dire.
 */

/** Assez court pour suivre la frappe, assez long pour ne pas tirer une
 *  requête par lettre. */
const DEBOUNCE_MS = 250;

const PROOF_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: "En attente", cls: "bg-gray-100 text-gray-700" },
  pickup_only: { text: "Prise en charge", cls: "bg-blue-100 text-blue-800" },
  complete: { text: "Complète", cls: "bg-green-100 text-green-800" },
  missing: { text: "Manquante", cls: "bg-red-100 text-red-800" },
};

const EMPTY: ColisSearchResult = { rows: [], matched: 0, truncated: false };

function dt(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("fr-FR", { timeZone: "Africa/Tunis" });
}

/** « non figé à la prise en charge » : le nom vient des données courantes. */
function nameLabel(value: string | null, isCurrent: boolean) {
  if (!value) return "—";
  return isCurrent ? `${value} (actuel)` : value;
}

export default function ColisReceiptsTable({
  initial,
}: {
  initial: ColisSearchResult;
}) {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  /** Le résultat serveur, ÉTIQUETÉ par les filtres qui l'ont produit. Sans
   *  cette étiquette, le résultat de la recherche précédente resterait
   *  affiché pendant les 250 ms de la suivante — l'admin lirait des lignes qui
   *  ne répondent plus à ce qu'il a tapé. */
  const [settled, setSettled] = useState<{
    key: string;
    data: ColisSearchResult | null;
    error: string | null;
  } | null>(null);

  /** Incrémenté après une clôture forcée, pour invalider la recherche. */
  const [revision, setRevision] = useState(0);

  const [open, setOpen] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** undefined = jamais demandé, "loading" = en cours, null = non renseigné. */
  const [cins, setCins] = useState<
    Record<string, string | null | "loading">
  >({});

  const filtersActive = hasFilters({ q, from, to });

  // L'identité de la recherche courante. `revision` y entre pour qu'une
  // clôture forcée relance la recherche en cours : router.refresh() ne met à
  // jour que la vue rendue par le serveur, et une clôture ne change ni le
  // nombre de bons ni leur ordre — sans ce compteur, la ligne qu'on vient de
  // clôturer resterait affichée telle qu'elle était avant.
  const key = `${q.trim()}|${from}|${to}|${revision}`;

  // Tout est DÉRIVÉ de `key` : rien n'est recopié dans un état au montage, et
  // l'effet n'appelle setState que depuis son minuteur. Un setState
  // synchrone dans le corps d'un effet déclenche des rendus en cascade
  // (react-hooks/set-state-in-effect).
  const current = settled?.key === key ? settled : null;
  const result = filtersActive ? current?.data ?? EMPTY : initial;
  const loading = filtersActive && current === null;
  const searchError = current?.error ?? null;

  useEffect(() => {
    if (!filtersActive) return;

    let cancelled = false;
    const ctl = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (from) params.set("from", from);
        if (to) params.set("to", to);

        const res = await fetch(`/api/colis/search?${params.toString()}`, {
          signal: ctl.signal,
        });
        const body = await res.json();
        if (cancelled) return;
        setSettled({
          key,
          data: res.ok ? (body as ColisSearchResult) : null,
          error: res.ok ? null : body.error ?? "La recherche a échoué.",
        });
      } catch (e) {
        if (cancelled || (e as Error).name === "AbortError") return;
        setSettled({ key, data: null, error: "La recherche a échoué." });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q, from, to, filtersActive, key]);

  async function revealCin(orderId: string) {
    if (cins[orderId] !== undefined) return;
    setCins((prev) => ({ ...prev, [orderId]: "loading" }));
    try {
      const res = await fetch(
        `/api/colis/cin?order_id=${encodeURIComponent(orderId)}`
      );
      const body = await res.json();
      setCins((prev) => ({
        ...prev,
        [orderId]: res.ok ? (body.cin as string | null) ?? null : null,
      }));
    } catch {
      setCins((prev) => ({ ...prev, [orderId]: null }));
    }
  }

  async function forceClose(orderId: string) {
    if (!reason.trim()) {
      setError("Le motif est obligatoire.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/colis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, reason: reason.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "La clôture a échoué.");
        return;
      }
      setClosing(null);
      setReason("");
      // Les deux : refresh() pour la vue serveur, revision pour la recherche
      // éventuellement en cours.
      setRevision((n) => n + 1);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function clearFilters() {
    setQ("");
    setFrom("");
    setTo("");
  }

  const rows = result.rows;
  const hidden = result.matched - rows.length;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-56">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Téléphone, n° de commande, nom, contenu…"
              className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <CalendarRange size={14} className="text-gray-400" />
            du
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border rounded-lg p-1.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            au
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border rounded-lg p-1.5 text-sm"
            />
          </label>
          {filtersActive && (
            <button
              onClick={clearFilters}
              className="px-2.5 py-2 rounded-lg border text-sm inline-flex items-center gap-1 hover:bg-gray-50"
            >
              <X size={14} />
              Effacer
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500">
          {/* Le numéro est normalisé : « 94 240 607 », « +21694240607 » et
              « 94240607 » visent le même enregistrement. Les dates portent sur
              la DÉCLARATION du colis, heure de Tunis. */}
          Les trois écritures d&apos;un numéro sont équivalentes. Les dates
          portent sur la déclaration du colis, heure de Tunis. Le CIN
          n&apos;est pas cherchable.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {loading ? (
            <span className="text-gray-500">Recherche…</span>
          ) : (
            <span className="text-gray-600">
              <b>{result.matched}</b> bon{result.matched > 1 ? "s" : ""}
              {filtersActive ? " correspondant" : ""}
              {filtersActive && result.matched > 1 ? "s" : ""}
              {hidden > 0 && ` — ${rows.length} affiché${rows.length > 1 ? "s" : ""}`}
            </span>
          )}
          {searchError && <span className="text-red-600">{searchError}</span>}
        </div>

        {result.truncated && (
          // Une recherche tronquée en silence ferait déclarer introuvable un
          // colis qui existe. On le dit, et on dit quoi faire.
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            Trop de bons pour tout examiner : les plus anciens n&apos;ont pas
            été parcourus. Resserrez la période pour une recherche exhaustive.
          </p>
        )}
      </div>

      {!rows.length ? (
        <p className="text-gray-500 text-sm">
          {filtersActive
            ? "Aucun bon ne correspond à cette recherche."
            : "Aucun bon de prise en charge."}
        </p>
      ) : (
        rows.map((r) => {
          const badge = PROOF_LABEL[r.proof_status] ?? PROOF_LABEL.pending;
          const expanded = open === r.order_id;
          return (
            <div
              key={r.order_id}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden"
            >
              <button
                onClick={() => setOpen(expanded ? null : r.order_id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
              >
                <span className="font-mono text-xs text-gray-500">
                  #{r.order_id.slice(0, 8).toUpperCase()}
                </span>
                <span className="flex-1 truncate text-sm">
                  {r.description ?? "—"}
                </span>
                {r.code_locked_at && (
                  <span className="flex items-center gap-1 text-xs text-red-700">
                    <Lock size={13} /> bloqué
                  </span>
                )}
                {r.disputes_on_order > 0 && (
                  <span className="flex items-center gap-1 text-xs text-orange-700">
                    <AlertTriangle size={13} /> {r.disputes_on_order}
                  </span>
                )}
                <span className={`text-xs px-2 py-1 rounded-full ${badge.cls}`}>
                  {badge.text}
                </span>
              </button>

              {expanded && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <Row
                        label="Expéditeur"
                        value={nameLabel(
                          r.sender_name,
                          r.sender_name_is_current
                        )}
                      />
                      <Row label="Téléphone" value={r.sender_phone ?? "—"} />
                      <Row
                        label="Destinataire"
                        value={r.recipient_name ?? "—"}
                      />
                      <Row
                        label="Tél. destinataire"
                        value={r.recipient_phone ?? "—"}
                      />
                      <Row
                        label="Déclaré le"
                        value={dt(r.created_at)}
                      />
                      <Row
                        label="Valeur déclarée"
                        value={
                          r.declared_value == null
                            ? "—"
                            : `${Number(r.declared_value).toFixed(3)} TND`
                        }
                      />
                      <Row
                        label="Mode"
                        value={
                          r.delivery_mode === "no_code"
                            ? `Sans code — remis à ${r.receiver_label ?? "?"}`
                            : "Code à 4 chiffres"
                        }
                      />
                      {r.delivery_mode === "no_code" && (
                        <Row
                          label="Accepté le"
                          value={dt(r.no_code_accepted_at)}
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Row
                        label="Livreur"
                        value={nameLabel(
                          r.driver_name,
                          r.driver_name_is_current
                        )}
                      />
                      <Row label="Tél. livreur" value={r.driver_phone ?? "—"} />
                      <Row label="Plaque" value={r.driver_plate ?? "—"} />
                      {/* Le CIN ne voyage pas avec la liste : il se demande
                          ici, bon par bon, et la consultation est
                          journalisée. */}
                      <CinRow
                        state={cins[r.order_id]}
                        onReveal={() => revealCin(r.order_id)}
                      />
                      <Row
                        label="Essais de code"
                        value={`${r.code_attempts} / 5${
                          r.code_locked_at ? " — bloqué" : ""
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Proof
                      title="Prise en charge"
                      at={r.pickup_at}
                      lat={r.pickup_lat}
                      lng={r.pickup_lng}
                      url={r.pickup_url}
                    />
                    <Proof
                      title="Remise"
                      at={r.delivery_at}
                      lat={r.delivery_lat}
                      lng={r.delivery_lng}
                      url={r.delivery_url}
                      extra={
                        <>
                          {r.delivery_distance_m != null && (
                            <p className="text-xs text-gray-600">
                              {r.delivery_distance_m} m de l&apos;adresse
                            </p>
                          )}
                          <p className="text-xs flex items-center gap-1">
                            {r.code_verified ? (
                              <>
                                <ShieldCheck
                                  size={13}
                                  className="text-green-700"
                                />
                                <span className="text-green-700">
                                  Code vérifié
                                </span>
                              </>
                            ) : (
                              <>
                                <ShieldX size={13} className="text-orange-700" />
                                <span className="text-orange-700">
                                  {r.delivery_mode === "no_code"
                                    ? "Sans code (accepté par l'expéditeur)"
                                    : "Code non vérifié"}
                                </span>
                              </>
                            )}
                          </p>
                        </>
                      }
                    />
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                    <span>
                      Litiges de ce client : <b>{r.disputes_by_customer}</b>
                    </span>
                    <span>
                      Litiges de ce livreur : <b>{r.disputes_by_driver}</b>
                    </span>
                  </div>

                  {r.admin_override_at ? (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
                      <p className="font-semibold text-amber-900">
                        Clôturée par un administrateur le{" "}
                        {dt(r.admin_override_at)}
                      </p>
                      <p className="text-amber-800 mt-1">
                        {r.admin_override_reason}
                      </p>
                    </div>
                  ) : closing === r.order_id ? (
                    <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="Motif de la clôture — obligatoire, conservé avec le bon"
                        className="w-full border rounded-lg p-2 text-sm"
                      />
                      {error && <p className="text-sm text-red-600">{error}</p>}
                      <div className="flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() => forceClose(r.order_id)}
                          className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50"
                        >
                          {busy ? "..." : "Clôturer la livraison"}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            setClosing(null);
                            setError(null);
                          }}
                          className="px-3 py-2 rounded-lg border text-sm"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {/* Pièce de preuve pour un litige, un assureur ou une
                          plainte. Un lien, pas un fetch : le navigateur gère le
                          téléchargement, et la route exige déjà la session
                          admin (requireAdmin). Disponible sur TOUT bon, même
                          incomplet — un bon dont les preuves manquent est
                          précisément celui qu'un litige réclame, et le PDF
                          écrit « Non enregistré » là où le serveur n'a rien.
                          Reste présent sur chaque résultat de recherche. */}
                      <a
                        href={`/api/colis/pdf?order_id=${encodeURIComponent(r.order_id)}`}
                        className="px-3 py-2 rounded-lg border text-sm inline-flex items-center gap-1.5 hover:bg-gray-50"
                      >
                        <FileDown className="w-4 h-4" />
                        Télécharger le bon (PDF)
                      </a>
                      {r.order_status !== "delivered" && (
                        <button
                          onClick={() => {
                            setClosing(r.order_id);
                            setReason("");
                          }}
                          className="px-3 py-2 rounded-lg border border-red-300 text-red-700 text-sm"
                        >
                          Clôturer de force
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex gap-2">
      <span className="text-gray-500 w-32 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

/** Le CIN, sur demande explicite. Chaque clic est inscrit au journal. */
function CinRow({
  state,
  onReveal,
}: {
  state: string | null | "loading" | undefined;
  onReveal: () => void;
}) {
  return (
    <p className="flex gap-2 items-center">
      <span className="text-gray-500 w-32 shrink-0">CIN</span>
      {state === undefined ? (
        <button
          onClick={onReveal}
          className="text-sm text-blue-700 inline-flex items-center gap-1 hover:underline"
        >
          <Eye size={13} />
          Afficher
        </button>
      ) : state === "loading" ? (
        <span className="text-gray-400">…</span>
      ) : (
        <span className="font-medium">{state ?? "non renseigné"}</span>
      )}
    </p>
  );
}

function Proof({
  title,
  at,
  lat,
  lng,
  url,
  extra,
}: {
  title: string;
  at: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-gray-600">{dt(at)}</p>
      {lat != null && lng != null && (
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 flex items-center gap-1"
        >
          <MapPin size={12} /> {lat.toFixed(5)}, {lng.toFixed(5)}
        </a>
      )}
      {extra}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title}
          className="mt-1 rounded-lg border w-full max-h-56 object-cover"
        />
      ) : (
        <p className="text-xs text-gray-400 mt-1">Pas de photo</p>
      )}
    </div>
  );
}

export type { ColisReceiptListRow };
