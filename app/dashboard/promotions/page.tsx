export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase-admin";
import PageHeader from "@/components/PageHeader";
import StatsCard from "@/components/StatsCard";
import PromotionsClient, { PromotionGroup } from "@/components/PromotionsClient";
import { Percent, Flame, Clock } from "lucide-react";

/** Une ligne de `vendor_items` portant une remise, avec sa boutique. */
interface ItemRow {
  id: string;
  name: string | null;
  category: string | null;
  price: number | null;
  discount_price: number | null;
  discount_percent: number | null;
  discount_start_time: string | null;
  discount_end_time: string | null;
  vendor_id: string;
  vendors: { name: string | null; category: string | null } | null;
}

/**
 * Les remises d'articles en cours ou à venir, regroupées comme le commerçant
 * les a posées.
 *
 * Une promotion de rubrique n'existe pas en base : c'est N lignes de
 * `vendor_items` portant le même taux et la même fenêtre. Les lister une par
 * une donnerait quarante lignes là où le commerçant a fait un seul geste, et
 * l'administrateur ne verrait plus la forêt. On regroupe donc sur
 * (boutique, rubrique, taux, début, fin) et on n'affiche le nom de l'article
 * que lorsque le groupe en contient un seul.
 */
async function getPromotions(): Promise<{
  groups: PromotionGroup[];
  activeItems: number;
  upcomingItems: number;
}> {
  const { data, error } = await supabaseAdmin
    .from("vendor_items")
    .select(
      "id, name, category, price, discount_price, discount_percent, " +
        "discount_start_time, discount_end_time, vendor_id, " +
        "vendors!inner(name, category)"
    )
    .or("discount_price.not.is.null,discount_percent.not.is.null");

  if (error) {
    console.error("promotions query error:", JSON.stringify(error));
    return { groups: [], activeItems: 0, upcomingItems: 0 };
  }

  const now = Date.now();
  const rows = (data ?? []) as unknown as ItemRow[];
  const buckets = new Map<string, PromotionGroup>();
  let activeItems = 0;
  let upcomingItems = 0;

  for (const r of rows) {
    const end = r.discount_end_time ? Date.parse(r.discount_end_time) : null;
    // Le cron clear_expired_promotions balaie chaque minute ; une promotion
    // expirée qui traîne encore ici ne doit pas être listée comme vivante.
    if (end !== null && end <= now) continue;

    const start = r.discount_start_time ? Date.parse(r.discount_start_time) : null;
    const hasPrice = r.discount_price != null;
    // Programmée : le taux est posé, le prix ne le sera qu'au début. C'est
    // exactement ce que l'application partenaire écrit pour une promotion
    // future, et ce qui empêche le client de la voir partir en avance.
    const state: PromotionGroup["state"] =
      hasPrice && (start === null || start <= now) ? "active" : "upcoming";
    if (state === "active") activeItems += 1;
    else upcomingItems += 1;

    const price = Number(r.price ?? 0);
    const percent =
      r.discount_percent != null
        ? Number(r.discount_percent)
        : hasPrice && price > 0
          ? Math.round((1 - Number(r.discount_price) / price) * 10000) / 100
          : null;

    const rubrique = r.category ?? "";
    const key = [
      r.vendor_id,
      rubrique,
      percent ?? "",
      r.discount_start_time ?? "",
      r.discount_end_time ?? "",
      state,
    ].join("|");

    const existing = buckets.get(key);
    if (existing) {
      existing.itemIds.push(r.id);
      existing.itemCount += 1;
      continue;
    }
    buckets.set(key, {
      key,
      shopName: r.vendors?.name ?? "—",
      shopCategory: r.vendors?.category ?? "",
      rubrique,
      itemName: r.name ?? "—",
      itemIds: [r.id],
      itemCount: 1,
      percent,
      startTime: r.discount_start_time,
      endTime: r.discount_end_time,
      state,
    });
  }

  const groups = [...buckets.values()].sort((a, b) => {
    // Ce qui tourne d'abord, puis ce qui se termine le plus tôt : c'est dans
    // cet ordre qu'un administrateur a une raison d'intervenir.
    if (a.state !== b.state) return a.state === "active" ? -1 : 1;
    const ae = a.endTime ? Date.parse(a.endTime) : Number.MAX_SAFE_INTEGER;
    const be = b.endTime ? Date.parse(b.endTime) : Number.MAX_SAFE_INTEGER;
    return ae - be;
  });

  return { groups, activeItems, upcomingItems };
}

export default async function PromotionsPage() {
  const { groups, activeItems, upcomingItems } = await getPromotions();

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Percent}
        title="Promotions"
        subtitle={<>Remises posées par les commerçants sur leurs articles</>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="En cours"
          value={String(activeItems)}
          icon={Flame}
          color="orange"
          subtitle="articles remisés en ce moment"
        />
        <StatsCard
          title="Programmées"
          value={String(upcomingItems)}
          icon={Clock}
          color="blue"
          subtitle="articles dont la remise n'a pas encore démarré"
        />
        <StatsCard
          title="Opérations"
          value={String(groups.length)}
          icon={Percent}
          color="green"
          subtitle="promotions distinctes (article ou rubrique)"
        />
      </div>

      <PromotionsClient groups={groups} />
    </div>
  );
}
