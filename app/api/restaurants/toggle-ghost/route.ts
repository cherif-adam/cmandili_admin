import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
  return NextResponse.json({ ok: true });
}
