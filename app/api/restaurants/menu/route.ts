import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, getSessionUser } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurant_id");
  if (!restaurantId) {
    return NextResponse.json({ error: "Missing restaurant_id" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("food_items")
    .select("id, name, description, price, category, is_available, image_url")
    .eq("restaurant_id", restaurantId)
    .order("category");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { restaurant_id, name, description, price, category } = body;
  if (!restaurant_id || !name || price == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("food_items")
    .insert({
      restaurant_id,
      name,
      description: description ?? "",
      price: Number(price),
      category: category ?? "",
      is_available: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const admin = await getSessionUser();
  await logAudit({
    admin_id: admin?.id ?? null,
    admin_email: admin?.email ?? "unknown",
    action_type: "add_menu_item",
    target_type: "food_item",
    target_id: data.id,
    details: { name, price: Number(price), restaurant_id },
  });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, name, description, price, category, is_available } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("food_items")
    .update({ name, description, price: Number(price), category, is_available })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const admin = await getSessionUser();
  await logAudit({
    admin_id: admin?.id ?? null,
    admin_email: admin?.email ?? "unknown",
    action_type: "update_menu_item",
    target_type: "food_item",
    target_id: id,
    details: { name, price: Number(price), is_available },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabaseAdmin.from("food_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const admin = await getSessionUser();
  await logAudit({
    admin_id: admin?.id ?? null,
    admin_email: admin?.email ?? "unknown",
    action_type: "delete_menu_item",
    target_type: "food_item",
    target_id: id,
  });
  return NextResponse.json({ ok: true });
}
