import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

// POST — create a new promo code
export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { code, type, value, min_order_amount, max_uses,
          max_uses_per_customer, valid_from, expires_at, is_active } = body;

  if (!code || !type || value == null) {
    return NextResponse.json({ error: "code, type et value sont requis" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("promo_codes")
    .insert({
      code: (code as string).toUpperCase().trim(),
      type,
      value: Number(value),
      min_order_amount: min_order_amount ? Number(min_order_amount) : null,
      max_uses: max_uses ? Number(max_uses) : null,
      max_uses_per_customer: max_uses_per_customer ? Number(max_uses_per_customer) : null,
      valid_from: valid_from || null,
      expires_at: expires_at || null,
      is_active: is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    const msg = error.message.includes("promo_codes_code_upper_idx")
      ? "Ce code existe déjà"
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true, promo: data });
}

// PATCH — update an existing promo code (full update or just toggle is_active)
export async function PATCH(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  // Normalize numeric fields
  const update: Record<string, unknown> = { ...fields };
  if (fields.code) update.code = (fields.code as string).toUpperCase().trim();
  if (fields.value != null) update.value = Number(fields.value);
  if (fields.min_order_amount != null) update.min_order_amount = fields.min_order_amount === "" ? null : Number(fields.min_order_amount);
  if (fields.max_uses != null) update.max_uses = fields.max_uses === "" ? null : Number(fields.max_uses);
  if (fields.max_uses_per_customer != null) update.max_uses_per_customer = fields.max_uses_per_customer === "" ? null : Number(fields.max_uses_per_customer);
  if (fields.valid_from === "") update.valid_from = null;
  if (fields.expires_at === "") update.expires_at = null;

  const { error } = await supabaseAdmin
    .from("promo_codes")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — delete a promo code
export async function DELETE(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const { error } = await supabaseAdmin.from("promo_codes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
