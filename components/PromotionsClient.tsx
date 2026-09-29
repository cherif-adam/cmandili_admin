"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Clock, Square, X } from "lucide-react";

export interface PromotionGroup {
  /** Identité du groupe, stable entre deux rendus. */
  key: string;
  shopName: string;
  shopCategory: string;
  /** Rubrique DANS la boutique ("Bouquets"), pas la catégorie de commerce. */
  rubrique: string;
  /** Nom de l'article, utile seulement quand le groupe en contient un seul. */
  itemName: string;
  itemIds: string[];
  itemCount: number;
  percent: number | null;
  startTime: string | null;
  endTime: string | null;
  state: "active" | "upcoming";
}

const CATEGORY_LABELS: Record<string, string> = {
  food: "Restaurants",
  grocery: "Supermarché",
  bakery: "Pâtisserie",
  flowers: "Fleurs",
  pets: "Animalerie",
  gifts: "Cadeaux",
  electronics: "Électronique",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tunis",
  });
}

function formatPercent(p: number | null): string {
  if (p == null) return "—";
  return Number.isInteger(p) ? `−${p} %` : `−${p.toFixed(2)} %`;
}

/**
 * La liste des remises d'articles, avec un bouton d'arrêt par opération.
 *
 * « Arrêter » remet l'article à son prix normal en vidant les cinq colonnes de
 * remise — le même geste que le bouton du commerçant, exécuté ici par
 * l'administrateur. C'est délibérément la seule action offerte : l'admin
 * intervient pour STOPPER une promotion abusive ou erronée, pas pour en
 * inventer une à la place du commerçant, qui seul connaît sa marge.
 */
export default function PromotionsClient({ groups }: { groups: PromotionGroup[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<PromotionGroup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function stopPromotion() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_ids: target.itemIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      setTarget(null);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  const cell = "px-4 py-3 text-sm";
  const head =
    "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide";

  return (
    <>
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ borderBottom: "1px solid var(--border)" }}>
              <tr style={{ color: "var(--text-muted)" }}>
                <th className={head}>Boutique</th>
                <th className={head}>Portée</th>
                <th className={head}>Remise</th>
                <th className={head}>Début</th>
                <th className={head}>Fin</th>
                <th className={head}>État</th>
                <th className={head}>Action</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.key} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className={cell}>
                    <div style={{ color: "var(--text)" }} className="font-medium">
                      {g.shopName}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                      {CATEGORY_LABELS[g.shopCategory] ?? g.shopCategory}
                    </div>
                  </td>
                  <td className={cell} style={{ color: "var(--text)" }}>
                    {g.itemCount > 1 ? (
                      <>
                        <div className="font-medium">{g.rubrique || "Rubrique"}</div>
                        <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                          {g.itemCount} articles
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium">{g.itemName}</div>
                        {g.rubrique && (
                          <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                            {g.rubrique}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td
                    className={`${cell} font-semibold`}
                    style={{ color: g.state === "active" ? "#f59e0b" : "#3b82f6" }}
                  >
                    {formatPercent(g.percent)}
                  </td>
                  <td className={cell} style={{ color: "var(--text-muted)" }}>
                    {g.startTime ? formatDateTime(g.startTime) : "Immédiat"}
                  </td>
                  <td className={cell} style={{ color: "var(--text-muted)" }}>
                    {g.endTime ? formatDateTime(g.endTime) : "Sans fin"}
                  </td>
                  <td className={cell}>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
                      style={
                        g.state === "active"
                          ? { background: "rgba(245,158,11,0.14)", color: "#f59e0b" }
                          : { background: "rgba(59,130,246,0.14)", color: "#3b82f6" }
                      }
                    >
                      {g.state === "active" ? <Flame size={12} /> : <Clock size={12} />}
                      {g.state === "active" ? "En cours" : "Programmée"}
                    </span>
                  </td>
                  <td className={cell}>
                    <button
                      onClick={() => setTarget(g)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                      style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
                      title="Arrêter cette promotion"
                    >
                      <Square size={12} />
                      Arrêter
                    </button>
                  </td>
                </tr>
              ))}
              {!groups.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Aucune promotion en cours ni programmée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-md rounded-xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>
                Arrêter la promotion
              </h3>
              <button
                onClick={() => setTarget(null)}
                style={{ color: "var(--text-muted)" }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {target.itemCount > 1 ? (
                  <>
                    <strong style={{ color: "var(--text)" }}>{target.itemCount} articles</strong>{" "}
                    de la rubrique « {target.rubrique} » chez{" "}
                    <strong style={{ color: "var(--text)" }}>{target.shopName}</strong>{" "}
                    reviendront à leur prix normal.
                  </>
                ) : (
                  <>
                    <strong style={{ color: "var(--text)" }}>{target.itemName}</strong> chez{" "}
                    <strong style={{ color: "var(--text)" }}>{target.shopName}</strong>{" "}
                    reviendra à son prix normal.
                  </>
                )}
              </p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                Les commandes déjà passées gardent le prix auquel elles ont été
                facturées. Le commerçant pourra reposer une promotion ensuite.
              </p>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
            <div
              className="flex justify-end gap-2 px-5 py-4"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <button
                onClick={() => setTarget(null)}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                style={{ background: "var(--border)", color: "var(--text)" }}
              >
                Annuler
              </button>
              <button
                onClick={stopPromotion}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "#ef4444" }}
              >
                {busy ? "Arrêt…" : "Arrêter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
