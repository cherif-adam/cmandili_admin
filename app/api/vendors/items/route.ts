import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

/**
 * Catalogue of one shop in the generic `vendors` table.
 *
 * Mirrors /api/supermarkets/menu, but against `vendor_items` so it works for
 * any category. The grocery-only fields (`unit`, `is_organic`) are kept
 * because they are genuinely useful beyond groceries — a florist sells by the
 * stem, a pet shop by the kilo.
 */

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const vendorId = req.nextUrl.searchParams.get("vendor_id");
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendor_id" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("vendor_items")
    .select(
      "id, name, description, price, category, unit, is_organic, is_available, " +
        "image_url, discount_price, discount_end_time, sort_order"
    )
    .eq("vendor_id", vendorId)
    .order("category")
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { vendor_id, name, description, price, category, unit } = body;
  if (!vendor_id || !name || price == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("vendor_items")
    .insert({
      vendor_id,
      name,
      description: description ?? "",
      price: Number(price),
      category: category ?? "",
      // Null rather than a default: most categories sell by the piece, and a
      // bogus "pièce" unit would print on every flower and phone case.
      unit: unit || null,
      is_available: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "add_menu_item",
    target_type: "vendor_item",
    target_id: data.id,
    details: { name, price: Number(price), vendor_id },
  });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { item_id, ...changes } = body;
  if (!item_id) {
    return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
  }

  const allowed = [
    "name", "description", "price", "category", "unit",
    "is_organic", "is_available", "image_url",
    "discount_price", "discount_end_time", "sort_order",
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in changes) patch[key] = changes[key];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }
  if ("price" in patch) patch.price = Number(patch.price);

  const { error } = await supabaseAdmin
    .from("vendor_items")
    .update(patch)
    .eq("id", item_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "update_menu_item",
    target_type: "vendor_item",
    target_id: item_id,
    details: patch,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const itemId = req.nextUrl.searchParams.get("item_id");
  if (!itemId) {
    return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("vendor_items").delete().eq("id", itemId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "delete_menu_item",
    target_type: "vendor_item",
    target_id: itemId,
    details: {},
  });
  return NextResponse.json({ ok: true });
}
