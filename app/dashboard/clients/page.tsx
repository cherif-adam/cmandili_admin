export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import StatsCard from "@/components/StatsCard";
import ClientsTable from "@/components/ClientsTable";
import { ClientData } from "@/components/ClientRow";
import { Users, ShieldX, ShoppingBag } from "lucide-react";

async function getClients(): Promise<ClientData[]> {
  // 1. Fetch all non-admin profiles
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, is_blocked, created_at")
    .eq("is_admin", false)
    .order("created_at", { ascending: false });

  if (!profiles?.length) return [];

  const profileIds = profiles.map((p) => p.id);

  // 2. Resolve who is a driver or partner (to exclude them)
  const [{ data: drivers }, { data: partners }] = await Promise.all([
    supabaseAdmin.from("drivers").select("user_id"),
    supabaseAdmin.from("partners").select("user_id"),
  ]);

  const driverIds = new Set((drivers ?? []).map((d) => d.user_id));
  const partnerIds = new Set((partners ?? []).map((p) => p.user_id));

  // Customers are profiles that are not drivers and not partners
  const customerProfiles = profiles.filter(
    (p) => !driverIds.has(p.id) && !partnerIds.has(p.id)
  );
  if (!customerProfiles.length) return [];

  const customerIds = customerProfiles.map((p) => p.id);

  // 3. Fetch emails from auth.users via admin API
  let emailById: Record<string, string> = {};
  try {
    // listUsers is paginated; for most apps a single page (1000) covers all customers
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    emailById = Object.fromEntries(
      (authData?.users ?? [])
        .filter((u) => customerIds.includes(u.id))
        .map((u) => [u.id, u.email ?? ""])
    );
  } catch {
    // Non-fatal: email column will show "—" if auth admin API fails
  }

  // 4. Fetch order stats for customers
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("user_id, total, status")
    .in("user_id", customerIds);

  const statsByUser: Record<string, { orderCount: number; totalSpent: number }> = {};
  for (const o of orders ?? []) {
    if (!o.user_id) continue;
    if (!statsByUser[o.user_id]) statsByUser[o.user_id] = { orderCount: 0, totalSpent: 0 };
    statsByUser[o.user_id].orderCount++;
    if (o.status === "delivered") {
      statsByUser[o.user_id].totalSpent += Number(o.total) || 0;
    }
  }

  return customerProfiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    phone: p.phone,
    email: emailById[p.id] ?? null,
    is_blocked: p.is_blocked ?? false,
    created_at: p.created_at,
    stats: statsByUser[p.id] ?? { orderCount: 0, totalSpent: 0 },
  }));
}

export default async function ClientsPage() {
  const clients = await getClients();

  const totalClients = clients.length;
  const blockedClients = clients.filter((c) => c.is_blocked).length;
  const totalOrders = clients.reduce((s, c) => s + c.stats.orderCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Clients</h2>
        <p className="text-sm text-gray-400 mt-1">Comptes clients de la plateforme</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Total clients"
          value={totalClients}
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="Comptes bloqués"
          value={blockedClients}
          icon={ShieldX}
          color="red"
        />
        <StatsCard
          title="Commandes totales"
          value={totalOrders}
          subtitle="Tous statuts confondus"
          icon={ShoppingBag}
          color="orange"
        />
      </div>

      <ClientsTable clients={clients} />
    </div>
  );
}
