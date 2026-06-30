import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supermarketId = req.nextUrl.searchParams.get("supermarket_id");
  if (!supermarketId) {
    return NextResponse.json({ error: "Missing supermarket_id" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("grocery_items")
    .select("id, name, description, price, category, unit, is_organic, is_available, image_url")
    .eq("supermarket_id", supermarketId)
    .order("category");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { supermarket_id, name, description, price, category, unit, is_organic } = body;
  if (!supermarket_id || !name || price == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("grocery_items")
    .insert({
      supermarket_id,
      name,
      description: description ?? "",
      price: Number(price),
      category: category ?? "",
      unit: unit ?? "pièce",
      is_organic: is_organic ?? false,
      is_available: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "add_menu_item",
    target_type: "grocery_item",
    target_id: data.id,
    details: { name, price: Number(price), supermarket_id },
  });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, name, description, price, category, unit, is_organic, is_available } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("grocery_items")
    .update({ name, description, price: Number(price), category, unit, is_organic, is_available })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "update_menu_item",
    target_type: "grocery_item",
    target_id: id,
    details: { name, price: Number(price), is_available },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabaseAdmin.from("grocery_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "delete_menu_item",
    target_type: "grocery_item",
    target_id: id,
  });
  return NextResponse.json({ ok: true });
}
