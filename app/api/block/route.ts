import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  // Verify the caller is an authenticated admin.
  // The middleware already checks this for the route, but we add an explicit
  // server-side check here as defence-in-depth.
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

  // Parse the body — supports both driver blocking and restaurant/partner blocking.
  const body = await req.json();
  const { driver_id, partner_id, blocked } = body;

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

  return NextResponse.json({ error: "Must provide driver_id or partner_id" }, { status: 400 });
}
