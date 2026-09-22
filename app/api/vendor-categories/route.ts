import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

/**
 * The category catalogue the client app's home grid is built from.
 *
 * Categories are rows rather than an enum precisely so a new one — pharmacy,
 * books, hardware — can be launched from here without an app release. The
 * apps read this table on startup and fall back to a built-in list if it is
 * unreachable.
 */

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("vendor_categories")
    .select("*")
    .order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, name_fr, name_en, name_ar, icon, color_hex, sort_order } = await req.json();

  if (!id || !name_fr) {
    return NextResponse.json({ error: "id et nom français requis" }, { status: 400 });
  }
  // The id becomes `vendors.category` and is matched by the apps, so it must
  // stay a stable, url-safe slug rather than a display name.
  if (!/^[a-z0-9_]+$/.test(id)) {
    return NextResponse.json(
      { error: "L'identifiant doit être en minuscules, sans espace (ex: pharmacie)" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("vendor_categories")
    .insert({
      id,
      name_fr,
      name_en: name_en || name_fr,
      name_ar: name_ar || name_fr,
      icon: icon || "🏪",
      color_hex: color_hex || "#059669",
      sort_order: sort_order != null ? Number(sort_order) : 100,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "create_vendor_category",
    target_type: "vendor_category",
    target_id: id,
    details: { name_fr },
  });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { category_id, ...changes } = await req.json();
  if (!category_id) {
    return NextResponse.json({ error: "Missing category_id" }, { status: 400 });
  }

  const allowed = ["name_fr", "name_en", "name_ar", "icon", "color_hex", "sort_order", "is_active"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in changes) patch[k] = changes[k];
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("vendor_categories")
    .update(patch)
    .eq("id", category_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "update_vendor_category",
    target_type: "vendor_category",
    target_id: category_id,
    details: patch,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("category_id");
  if (!id) return NextResponse.json({ error: "Missing category_id" }, { status: 400 });

  // Vendors reference the category by foreign key, so deleting one that is in
  // use would fail at the database anyway. Refuse with a message the admin can
  // act on, and point them at deactivation instead — which hides the category
  // from the apps without touching its shops.
  const { count } = await supabaseAdmin
    .from("vendors")
    .select("id", { count: "exact", head: true })
    .eq("category", id);

  if (count && count > 0) {
    return NextResponse.json(
      {
        error: `${count} boutique(s) utilisent cette catégorie. Désactivez-la au lieu de la supprimer.`,
      },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin.from("vendor_categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "delete_vendor_category",
    target_type: "vendor_category",
    target_id: id,
    details: {},
  });
  return NextResponse.json({ ok: true });
}
