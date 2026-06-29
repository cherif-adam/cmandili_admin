// POST /api/releve
// This route is NOT in the proxy middleware matcher, so we verify admin auth explicitly.
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

function generateReferenceCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  // Unambiguous characters only (no 0/O, 1/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const random = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `REL-${date}-${random}`;
}

interface OrderSnap {
  id: string;
  date: string;
  label: string;   // restaurant name (driver stmts) or customer name (restaurant stmts)
  amount: number;  // delivery_fee (driver) or subtotal (restaurant)
  commission: number; // driver_fee_cut or platform_fee
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { entity_type, entity_id, entity_name, entity_phone, date_from, date_to } = body;

  if (!entity_type || !entity_id || !entity_name || !date_from || !date_to) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }
  if (!["driver", "restaurant"].includes(entity_type)) {
    return NextResponse.json({ error: "entity_type invalide" }, { status: 400 });
  }

  const fromTs = date_from + "T00:00:00.000Z";
  const toTs   = date_to   + "T23:59:59.999Z";

  let snapshot: OrderSnap[] = [];

  if (entity_type === "driver") {
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("id, created_at, delivery_fee, driver_fee_cut, restaurant_id")
      .eq("driver_id", entity_id)
      .eq("status", "delivered")
      .gte("created_at", fromTs)
      .lte("created_at", toTs)
      .order("created_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const orders_ = orders ?? [];
    const restaurantIds = [...new Set(orders_.map((o) => o.restaurant_id).filter(Boolean))];

    let restaurantMap: Record<string, string> = {};
    if (restaurantIds.length) {
      const { data: restaurants } = await supabaseAdmin
        .from("restaurants")
        .select("id, name")
        .in("id", restaurantIds);
      restaurantMap = Object.fromEntries((restaurants ?? []).map((r) => [r.id, r.name]));
    }

    snapshot = orders_.map((o) => ({
      id: o.id.slice(0, 8).toUpperCase(),
      date: o.created_at.slice(0, 10),
      label: restaurantMap[o.restaurant_id] ?? "—",
      amount: Number(o.delivery_fee) || 0,
      commission: Number(o.driver_fee_cut) || 0,
    }));
  } else {
    // restaurant — only delivered orders for a clean, dispute-proof statement
    const { data: orders, error } = await supabaseAdmin
      .from("orders_with_customer")
      .select("id, created_at, subtotal, platform_fee, customer_name")
      .eq("restaurant_id", entity_id)
      .eq("status", "delivered")
      .gte("created_at", fromTs)
      .lte("created_at", toTs)
      .order("created_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    snapshot = (orders ?? []).map((o) => ({
      id: o.id.slice(0, 8).toUpperCase(),
      date: o.created_at.slice(0, 10),
      label: o.customer_name ?? "—",
      amount: Number(o.subtotal) || 0,
      commission: Number(o.platform_fee) || 0,
    }));
  }

  const total_amount     = snapshot.reduce((s, o) => s + o.amount,     0);
  const total_commission = snapshot.reduce((s, o) => s + o.commission, 0);
  const reference_code   = generateReferenceCode();

  const { error: insertError } = await supabaseAdmin
    .from("generated_statements")
    .insert({
      reference_code,
      entity_type,
      entity_id,
      entity_name,
      entity_phone: entity_phone ?? null,
      date_from,
      date_to,
      order_count:      snapshot.length,
      total_amount,
      total_commission,
      orders_snapshot:  snapshot,
    });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({
    reference_code,
    order_count:      snapshot.length,
    total_amount,
    total_commission,
    orders: snapshot,
  });
}
