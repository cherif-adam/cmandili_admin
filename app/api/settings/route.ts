import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { restaurant_rate, driver_rate } = body;

  if (
    typeof restaurant_rate !== "number" || restaurant_rate <= 0 || restaurant_rate >= 1 ||
    typeof driver_rate !== "number" || driver_rate <= 0 || driver_rate >= 1
  ) {
    return NextResponse.json({ error: "Les taux doivent être entre 0 et 1 (exclus)" }, { status: 400 });
  }

  const updates = [
    { setting_key: "default_restaurant_commission_rate", setting_value: restaurant_rate.toString() },
    { setting_key: "default_driver_commission_rate", setting_value: driver_rate.toString() },
  ];

  for (const u of updates) {
    const { error } = await supabaseAdmin
      .from("global_settings")
      .update({ setting_value: u.setting_value, updated_at: new Date().toISOString() })
      .eq("setting_key", u.setting_key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
