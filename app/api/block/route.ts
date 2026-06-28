import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  // Defence-in-depth: verify admin session server-side even though
  // proxy already guards this route.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { driver_id, partner_id, customer_id, blocked } = body;

  if (typeof blocked !== "boolean") {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  if (driver_id) {
    const { error } = await supabaseAdmin
      .from("drivers")
      .update({ is_blocked: blocked })
      .eq("id", driver_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (partner_id) {
    const { error } = await supabaseAdmin
      .from("partners")
      .update({ is_blocked: blocked })
      .eq("id", partner_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (customer_id) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_blocked: blocked })
      .eq("id", customer_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Must provide driver_id, partner_id, or customer_id" }, { status: 400 });
}
