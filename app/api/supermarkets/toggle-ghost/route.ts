import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const { supermarket_id, is_ghost } = await req.json();
  if (!supermarket_id || typeof is_ghost !== "boolean") {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("supermarkets")
    .update({ is_ghost_restaurant: is_ghost })
    .eq("id", supermarket_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
