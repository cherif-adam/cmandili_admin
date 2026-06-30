export const dynamic = 'force-dynamic';
import { supabaseAdmin } from "@/lib/supabase-admin";
import { notFound } from "next/navigation";
import GhostMenuClient from "./GhostMenuClient";

async function getRestaurantWithMenu(id: string) {
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, is_ghost_restaurant")
    .eq("id", id)
    .maybeSingle();

  if (!restaurant) return null;

  const { data: items } = await supabaseAdmin
    .from("food_items")
    .select("id, name, description, price, category, is_available, image_url")
    .eq("restaurant_id", id)
    .order("category");

  return { restaurant, items: items ?? [] };
}

export default async function GhostMenuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getRestaurantWithMenu(id);
  if (!data) notFound();

  return (
    <GhostMenuClient
      restaurantId={data.restaurant.id}
      restaurantName={data.restaurant.name}
      isGhost={data.restaurant.is_ghost_restaurant ?? false}
      initialItems={data.items}
    />
  );
}
