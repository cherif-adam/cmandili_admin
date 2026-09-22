import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

/**
 * Shops in the generic `vendors` table — every category, including the ones
 * that have no dedicated dashboard page of their own (flowers, pets, gifts,
 * bakery, electronics).
 *
 * The older /api/restaurants and /api/supermarkets routes write through
 * category-filtered compatibility views, so they cannot see or create a
 * florist. This route works on the real table and takes the category as data.
 */

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const category = req.nextUrl.searchParams.get("category");

  let query = supabaseAdmin
    .from("vendors")
    .select(
      "id, category, name, description, image_url, rating, review_count, " +
        "delivery_time_min, delivery_fee, min_order, is_open, latitude, longitude, " +
        "opening_time, closing_time, auto_close_enabled, is_ghost_restaurant, created_at"
    )
    .order("name");

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { category, name, description, latitude, longitude, delivery_fee, min_order, delivery_time_min } = body;

  if (!category || !name) {
    return NextResponse.json({ error: "Missing category or name" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("vendors")
    .insert({
      category,
      name,
      description: description ?? "",
      image_url: "",
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      delivery_fee: delivery_fee != null ? Number(delivery_fee) : 0,
      min_order: min_order != null ? Number(min_order) : 0,
      delivery_time_min: delivery_time_min != null ? Number(delivery_time_min) : 30,
      is_open: true,
      // Created from the dashboard, so it is a platform-listed venue with no
      // partner account behind it until one signs up and claims it.
      is_ghost_restaurant: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "create_vendor",
    target_type: "vendor",
    target_id: data.id,
    details: { name, category },
  });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { vendor_id, ...changes } = body;
  if (!vendor_id) {
    return NextResponse.json({ error: "Missing vendor_id" }, { status: 400 });
  }

  // Whitelist: never let an arbitrary column through from the client, which
  // would allow rewriting ids or owner_id.
  const allowed = [
    "name", "description", "image_url", "is_open", "is_ghost_restaurant",
    "delivery_fee", "min_order", "delivery_time_min",
    "latitude", "longitude", "opening_time", "closing_time",
    "auto_close_enabled",
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in changes) patch[key] = changes[key];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("vendors")
    .update(patch)
    .eq("id", vendor_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "update_vendor",
    target_type: "vendor",
    target_id: vendor_id,
    details: patch,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const vendorId = req.nextUrl.searchParams.get("vendor_id");
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendor_id" }, { status: 400 });
  }

  // vendor_items cascades on the foreign key, so the catalogue goes with it.
  const { error } = await supabaseAdmin.from("vendors").delete().eq("id", vendorId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "delete_vendor",
    target_type: "vendor",
    target_id: vendorId,
    details: {},
  });
  return NextResponse.json({ ok: true });
}
