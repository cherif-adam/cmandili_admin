import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, getSessionUser } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { restaurant_id, is_ghost } = await req.json();
  if (!restaurant_id || typeof is_ghost !== "boolean") {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("restaurants")
    .update({ is_ghost_restaurant: is_ghost })
    .eq("id", restaurant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const admin = await getSessionUser();
  await logAudit({
    admin_id: admin?.id ?? null,
    admin_email: admin?.email ?? "unknown",
    action_type: is_ghost ? "enable_ghost_restaurant" : "disable_ghost_restaurant",
    target_type: "restaurant",
    target_id: restaurant_id,
  });
  return NextResponse.json({ ok: true });
}
