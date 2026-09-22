export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import VendorsBrowser from "@/components/VendorsBrowser";
import PageHeader from "@/components/PageHeader";
import CategoryManager from "@/components/CategoryManager";
import { Store, Layers, TrendingUp } from "lucide-react";

/**
 * Shops across every category — flowers, pet supplies, gifts, bakery and
 * electronics, alongside restaurants and supermarkets.
 *
 * The Restaurants and Supermarchés pages remain for those two verticals,
 * because they carry partner accounts, wallets and commission data this page
 * does not. This page is about the catalogue: which shops exist in each
 * category, and what they sell.
 */

interface CategoryRow {
  id: string;
  name_fr: string;
  icon: string;
  color_hex: string;
  sort_order: number;
  is_active?: boolean;
}

/**
 * Built-in catalogue, matching the seed rows in the generic-vendors migration
 * and the client app's own fallback list. Used when `vendor_categories` cannot
 * be read, so the filter bar is never empty and the admin can still see which
 * categories the apps offer.
 */
const FALLBACK_CATEGORIES: CategoryRow[] = [
  { id: "food", name_fr: "Restaurants", icon: "🍕", color_hex: "#FF6B35", sort_order: 10 },
  { id: "grocery", name_fr: "Supermarché", icon: "🛒", color_hex: "#1D9E75", sort_order: 20 },
  { id: "bakery", name_fr: "Pâtisserie", icon: "🥐", color_hex: "#D97706", sort_order: 30 },
  { id: "flowers", name_fr: "Fleurs", icon: "💐", color_hex: "#EC4899", sort_order: 40 },
  { id: "pets", name_fr: "Animalerie", icon: "🐾", color_hex: "#8B5CF6", sort_order: 50 },
  { id: "gifts", name_fr: "Cadeaux", icon: "🎁", color_hex: "#F59E0B", sort_order: 60 },
  { id: "electronics", name_fr: "Électronique", icon: "📱", color_hex: "#3B82F6", sort_order: 70 },
];

async function getData() {
  const [{ data: categories, error: catErr }, { data: vendors, error: venErr }] =
    await Promise.all([
      supabaseAdmin
        .from("vendor_categories")
        .select("id, name_fr, icon, color_hex, sort_order, is_active")
        .order("sort_order"),
      supabaseAdmin
        .from("vendors")
        .select("id, category, name, is_open, is_ghost_restaurant, delivery_fee, created_at")
        .order("name"),
    ]);

  // The migration has not been applied yet if these tables are missing. Show
  // an empty state rather than a Next.js error page.
  // `vendors` missing means the migration has not run — there is nothing to
  // list, so say so. A missing `vendor_categories` alone is recoverable: fall
  // back to the built-in catalogue rather than showing an empty filter bar.
  if (venErr) {
    console.error("vendors page query error:", venErr);
    return {
      categories: FALLBACK_CATEGORIES,
      categoriesEditable: false,
      vendors: [],
      itemCounts: {},
      migrated: false,
    };
  }

  const vendorIds = (vendors ?? []).map((v) => v.id);
  const itemCounts: Record<string, number> = {};
  if (vendorIds.length) {
    const { data: items } = await supabaseAdmin
      .from("vendor_items")
      .select("vendor_id")
      .in("vendor_id", vendorIds);
    for (const it of items ?? []) {
      itemCounts[it.vendor_id] = (itemCounts[it.vendor_id] ?? 0) + 1;
    }
  }

  return {
    categories:
      catErr || !categories?.length
        ? FALLBACK_CATEGORIES
        : (categories as CategoryRow[]),
    categoriesEditable: !catErr && !!categories?.length,
    vendors: vendors ?? [],
    itemCounts,
    migrated: true,
  };
}

export default async function VendorsPage() {
  const { categories, categoriesEditable, vendors, itemCounts, migrated } =
    await getData();

  if (!migrated) {
    return (
      <div className="space-y-4">
        <PageHeader icon={Store} title="Boutiques" />
        <CategoryManager categories={categories} available={false} />
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6">
          <p className="text-amber-300 font-medium mb-2">
            Les tables `vendors` ne sont pas encore créées.
          </p>
          <p className="text-gray-400 text-sm">
            Lancez la migration{" "}
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">
              20260921100000_generic_vendors.sql
            </code>{" "}
            dans le SQL Editor de Supabase, puis rechargez cette page.
          </p>
        </div>
      </div>
    );
  }

  const withoutItems = vendors.filter((v) => !itemCounts[v.id]).length;
  const totalItems = Object.values(itemCounts).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Store}
        title="Boutiques"
        subtitle="Toutes catégories — fleurs, animalerie, cadeaux, pâtisserie, électronique…"
      />

      <CategoryManager categories={categories} available={categoriesEditable} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatsCard title="Total boutiques" value={vendors.length} icon={Store} color="purple" />
        <StatsCard title="Catégories actives" value={categories.length} icon={Layers} color="blue" />
        <StatsCard title="Articles au catalogue" value={totalItems} icon={TrendingUp} color="blue" />
        <StatsCard title="Boutiques sans article" value={withoutItems} icon={Store} color="orange" />
      </div>

      <VendorsBrowser
        categories={categories}
        vendors={vendors}
        itemCounts={itemCounts}
      />
    </div>
  );
}
