export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import VendorItemsManager from "@/components/VendorItemsManager";
import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default async function VendorItemsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ data: vendor }, { data: items }] = await Promise.all([
    supabaseAdmin.from("vendors").select("id, name, category").eq("id", id).maybeSingle(),
    supabaseAdmin
      .from("vendor_items")
      .select("id, name, description, price, category, unit, is_available")
      .eq("vendor_id", id)
      .order("category")
      .order("sort_order"),
  ]);

  if (!vendor) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/vendors" className="text-gray-400 hover:text-white text-sm">
          ← Boutiques
        </Link>
        <p className="text-gray-400">Boutique introuvable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/dashboard/vendors"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-2"
        >
          <ArrowLeft size={14} />
          Boutiques
        </Link>
        <PageHeader
          icon={Store}
          title={vendor.name}
          subtitle={<>Catalogue — {vendor.category}</>}
        />
      </div>

      <VendorItemsManager vendorId={vendor.id} initialItems={items ?? []} />
    </div>
  );
}
