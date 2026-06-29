import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { supermarket_id, is_ghost } = await req.json();
  if (!supermarket_id || typeof is_ghost !== "boolean") {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("supermarkets")
    .update({ is_ghost_restaurant: is_ghost })
    .eq("id", supermarket_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: is_ghost ? "enable_ghost_supermarket" : "disable_ghost_supermarket",
    target_type: "supermarket",
    target_id: supermarket_id,
  });
  return NextResponse.json({ ok: true });
}
