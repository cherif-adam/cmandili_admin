import { supabaseAdmin } from "@/lib/supabase-admin";
import { notFound } from "next/navigation";
import GhostGroceryClient from "./GhostGroceryClient";

async function getSupermarketWithItems(id: string) {
  const { data: supermarket } = await supabaseAdmin
    .from("supermarkets")
    .select("id, name, is_ghost_restaurant")
    .eq("id", id)
    .maybeSingle();

  if (!supermarket) return null;

  const { data: items } = await supabaseAdmin
    .from("grocery_items")
    .select("id, name, description, price, category, unit, is_organic, is_available, image_url")
    .eq("supermarket_id", id)
    .order("category");

  return { supermarket, items: items ?? [] };
}

export default async function GhostGroceryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getSupermarketWithItems(id);
  if (!data) notFound();

  return (
    <GhostGroceryClient
      supermarketId={data.supermarket.id}
      supermarketName={data.supermarket.name}
      isGhost={data.supermarket.is_ghost_restaurant ?? true}
      initialItems={data.items}
    />
  );
}
