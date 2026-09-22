export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import PageHeader from "@/components/PageHeader";
import { Star, MessageSquare, TrendingDown, ThumbsUp } from "lucide-react";

/**
 * Customer ratings left after delivery.
 *
 * `order_ratings` is written by the client app's post-delivery prompt and
 * read by nothing — so a run of one-star reviews on a single restaurant was
 * invisible. Low scores are surfaced first here, because those are the ones
 * that need acting on.
 *
 * Note there is a second, older `reviews` table that the partner app reads to
 * compute its own average (keyed on entity_id). This page reads
 * `order_ratings`, which is what the client app actually writes today.
 */
async function getRatings() {
  const { data, error } = await supabaseAdmin
    .from("order_ratings")
    .select("id, order_id, user_id, restaurant_id, rating, comment, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("order_ratings query error:", error);
    return { ratings: [], available: false };
  }
  if (!data?.length) return { ratings: [], available: true };

  const userIds = [...new Set(data.map((r) => r.user_id).filter(Boolean))];
  const venueIds = [...new Set(data.map((r) => r.restaurant_id).filter(Boolean))];

  const [{ data: profiles }, { data: venues }] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    // Reads `vendors` when the migration has run, so a florist or bakery
    // review resolves too — `restaurants` would only cover food.
    venueIds.length
      ? supabaseAdmin.from("vendors").select("id, name").in("id", venueIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]));
  const venueById = Object.fromEntries((venues ?? []).map((v) => [v.id, v.name]));

  return {
    ratings: data.map((r) => ({
      id: r.id,
      rating: r.rating as number,
      comment: (r.comment as string | null) ?? null,
      createdAt: r.created_at as string,
      customer: nameById[r.user_id] ?? "Client",
      venue: venueById[r.restaurant_id] ?? "—",
    })),
    available: true,
  };
}

export default async function AvisPage() {
  const { ratings, available } = await getRatings();

  const avg =
    ratings.length > 0
      ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
      : 0;
  const low = ratings.filter((r) => r.rating <= 2);
  const withComment = ratings.filter((r) => r.comment && r.comment.trim());

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Star}
        title="Avis clients"
        subtitle="Notes laissées après livraison depuis l'application client."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard title="Total avis" value={ratings.length} icon={MessageSquare} color="blue" />
        <StatsCard
          title="Note moyenne"
          value={ratings.length ? `${avg.toFixed(2)} / 5` : "—"}
          icon={ThumbsUp}
          color="green"
        />
        <StatsCard title="Avis négatifs (≤2)" value={low.length} icon={TrendingDown} color="red" />
        <StatsCard title="Avec commentaire" value={withComment.length} icon={MessageSquare} color="orange" />
      </div>

      {!available ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-sm">
          <p className="font-medium text-amber-500">
            La table `order_ratings` est introuvable.
          </p>
        </div>
      ) : ratings.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center text-[13px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Aucun avis pour le moment.
        </div>
      ) : (
        <>
          {low.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[13px] font-semibold" style={{ color: "#ef4444" }}>
                À traiter en priorité ({low.length})
              </h3>
              <RatingTable rows={low} />
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-[13px] font-semibold">Tous les avis</h3>
            <RatingTable rows={ratings} />
          </div>
        </>
      )}
    </div>
  );
}

function RatingTable({
  rows,
}: {
  rows: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    customer: string;
    venue: string;
  }[];
}) {
  return (
    <div
      className="overflow-hidden rounded-lg"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Note</th>
              <th>Boutique</th>
              <th>Client</th>
              <th>Commentaire</th>
              <th className="text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">
                  <span
                    style={{
                      color:
                        r.rating <= 2 ? "#ef4444" : r.rating >= 4 ? "#10b981" : "#f59e0b",
                    }}
                  >
                    {"★".repeat(r.rating)}
                    <span style={{ color: "var(--text-faint)" }}>
                      {"★".repeat(5 - r.rating)}
                    </span>
                  </span>
                </td>
                <td className="font-medium">{r.venue}</td>
                <td style={{ color: "var(--text-muted)" }}>{r.customer}</td>
                <td style={{ color: "var(--text-muted)" }}>
                  {r.comment?.trim() || "—"}
                </td>
                <td className="text-right whitespace-nowrap" style={{ color: "var(--text-faint)" }}>
                  {new Date(r.createdAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
