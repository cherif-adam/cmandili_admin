export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import PromosClient, { PromoCode } from "@/components/PromosClient";
import { Tag, CheckCircle, TrendingUp } from "lucide-react";
import PageHeader from "@/components/PageHeader";

async function getPromos(): Promise<PromoCode[]> {
  const { data, error } = await supabaseAdmin
    .from("promo_codes")
    .select("id, code, type, value, min_order_amount, max_uses, max_uses_per_customer, valid_from, expires_at, is_active, used_count, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("promo_codes query error:", JSON.stringify(error));
    return [];
  }
  return (data ?? []) as PromoCode[];
}

export default async function PromosPage() {
  const promos = await getPromos();

  const activeCount = promos.filter((p) => p.is_active).length;
  const totalUses = promos.reduce((s, p) => s + p.used_count, 0);

  return (
    <div className="space-y-4">
      <PageHeader icon={Tag} title={"Promotions"} subtitle={<>Gestion des codes promo</>} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard title="Total codes" value={promos.length} icon={Tag} color="orange" />
        <StatsCard title="Codes actifs" value={activeCount} icon={CheckCircle} color="green" />
        <StatsCard title="Utilisations totales" value={totalUses} icon={TrendingUp} color="blue" />
      </div>

      <PromosClient promos={promos} />
    </div>
  );
}
