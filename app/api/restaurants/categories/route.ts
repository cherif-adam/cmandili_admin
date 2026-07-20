import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

// Canonical category values — must match the mobile app's home filter chips
// byte-for-byte (the client compares lowercased). Extend this list when new
// categories are introduced; never free-type category strings elsewhere.
const ALLOWED_CATEGORIES = [
  "Pizza",
  "Burgers",
  "Sushi",
  "Mexican",
  "Italian",
  "Fast Food",
  "Pâtisseries",
];

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { restaurant_id, categories } = await req.json();
  if (
    !restaurant_id ||
    !Array.isArray(categories) ||
    categories.some((c) => typeof c !== "string")
  ) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const invalid = categories.filter((c) => !ALLOWED_CATEGORIES.includes(c));
  if (invalid.length) {
    return NextResponse.json(
      { error: `Catégorie inconnue: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("restaurants")
    .update({ categories })
    .eq("id", restaurant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "update_restaurant_categories",
    target_type: "restaurant",
    target_id: restaurant_id,
  });
  return NextResponse.json({ ok: true });
}
