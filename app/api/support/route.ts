import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, requireAdmin } from "@/lib/audit";

/**
 * Support tickets raised from the three mobile apps.
 *
 * All three write into `support_tickets` with status 'open' and show the user
 * a "message sent" confirmation — but nothing in the dashboard ever read the
 * table, so every complaint has been going into a black hole since launch.
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { ticket_id, status } = await req.json();
  if (!ticket_id || !status) {
    return NextResponse.json({ error: "Missing ticket_id or status" }, { status: 400 });
  }
  if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("support_tickets")
    .update({ status })
    .eq("id", ticket_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    admin_id: admin.id,
    admin_email: admin.email ?? "unknown",
    action_type: "update_support_ticket",
    target_type: "support_ticket",
    target_id: ticket_id,
    details: { status },
  });
  return NextResponse.json({ ok: true });
}
