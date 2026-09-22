export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import PageHeader from "@/components/PageHeader";
import SupportTickets, { Ticket } from "@/components/SupportTickets";
import { LifeBuoy, AlertCircle, CheckCircle2, Clock } from "lucide-react";

/**
 * Customer, driver and partner support requests.
 *
 * The three apps all post into `support_tickets` and tell the user their
 * message was sent. Nothing read the table, so those messages were never
 * seen by anyone — this page is the missing half of that feature.
 */
async function getTickets(): Promise<{ tickets: Ticket[]; available: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .select("id, user_id, subject, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("support_tickets query error:", error);
    return { tickets: [], available: false };
  }
  if (!data?.length) return { tickets: [], available: true };

  // Attach a name to each ticket, and say which app the sender uses — a
  // driver's problem is usually operational, a customer's is about an order.
  const userIds = [...new Set(data.map((t) => t.user_id).filter(Boolean))];
  const [{ data: profiles }, { data: drivers }, { data: partners }] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; phone: string | null }[] }),
    supabaseAdmin.from("drivers").select("user_id"),
    supabaseAdmin.from("partners").select("user_id, business_name"),
  ]);

  const profileById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const driverIds = new Set((drivers ?? []).map((d) => d.user_id));
  const partnerById = Object.fromEntries(
    (partners ?? []).map((p) => [p.user_id, p.business_name as string | null])
  );

  const tickets: Ticket[] = data.map((t) => {
    const profile = profileById[t.user_id];
    const role: Ticket["role"] = driverIds.has(t.user_id)
      ? "driver"
      : t.user_id in partnerById
        ? "partner"
        : "client";
    return {
      id: t.id,
      subject: t.subject ?? "(sans objet)",
      message: t.message ?? "",
      status: (t.status ?? "open") as Ticket["status"],
      createdAt: t.created_at,
      name:
        role === "partner"
          ? partnerById[t.user_id] || profile?.full_name || "Partenaire"
          : profile?.full_name || "Utilisateur",
      phone: profile?.phone ?? null,
      role,
    };
  });

  return { tickets, available: true };
}

export default async function SupportPage() {
  const { tickets, available } = await getTickets();

  const open = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;
  const resolved = tickets.filter(
    (t) => t.status === "resolved" || t.status === "closed"
  ).length;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={LifeBuoy}
        title="Support"
        subtitle="Messages envoyés depuis les applications client, livreur et partenaire."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard title="Total" value={tickets.length} icon={LifeBuoy} color="blue" />
        <StatsCard title="Ouverts" value={open} icon={AlertCircle} color="red" />
        <StatsCard title="En cours" value={inProgress} icon={Clock} color="orange" />
        <StatsCard title="Résolus" value={resolved} icon={CheckCircle2} color="green" />
      </div>

      {!available ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-sm">
          <p className="mb-1 font-medium text-amber-500">
            La table `support_tickets` est introuvable.
          </p>
          <p style={{ color: "var(--text-muted)" }}>
            Les trois applications écrivent dedans ; vérifiez qu&apos;elle existe et que
            la clé service-role peut la lire.
          </p>
        </div>
      ) : (
        <SupportTickets tickets={tickets} />
      )}
    </div>
  );
}
