export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import OrdersTable from "@/components/OrdersTable";
import ExportButton from "@/components/ExportButton";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  ready: "Prête",
  picked_up: "Récupérée",
  on_the_way: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

async function getOrders(status?: string, dateFrom?: string) {
  let query = supabaseAdmin
    .from("orders_with_customer")
    .select(
      "id, status, created_at, subtotal, delivery_fee, total, platform_fee, driver_fee_cut, payment_method, customer_name, restaurant_id, driver_id, assigned_driver_id, self_delivery"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (dateFrom) query = query.gte("created_at", dateFrom);

  const { data: orders } = await query;

  if (!orders?.length) return [];

  const restaurantIds = [...new Set(orders.map((o) => o.restaurant_id).filter(Boolean))];

  const { data: restaurants } = await supabaseAdmin
    .from("restaurants")
    .select("id, name")
    .in("id", restaurantIds);

  const restaurantMap = Object.fromEntries(
    (restaurants ?? []).map((r) => [r.id, r.name])
  );

  return orders.map((o) => ({
    ...o,
    restaurantName: restaurantMap[o.restaurant_id] ?? "—",
  }));
}

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string }>;
}) {
  const params = await searchParams;
  const orders = await getOrders(params.status, params.from);

  const totalOrders = orders.length;
  const deliveredOrders = orders.filter((o) => o.status === "delivered");
  const totalCommissions = deliveredOrders.reduce(
    (s, o) => s + (Number(o.platform_fee) || 0) + (Number(o.driver_fee_cut) || 0),
    0
  );

  // Build export rows (pre-formatted strings, same columns as the table)
  const exportColumns = [
    "ID", "Date", "Client", "Restaurant", "Statut",
    "Sous-total (TND)", "Livraison (TND)", "Total (TND)",
    "Comm. resto (TND)", "Comm. livreur (TND)", "Paiement",
  ];
  const exportRows = orders.map((o) => [
    o.id.slice(0, 8).toUpperCase(),
    new Date(o.created_at).toLocaleDateString("fr-FR"),
    o.customer_name ?? "—",
    o.restaurantName ?? "—",
    (STATUS_LABELS[o.status] ?? o.status) + (o.self_delivery ? " (auto-livré)" : ""),
    (o.subtotal ?? 0).toFixed(3),
    (o.delivery_fee ?? 0).toFixed(3),
    (o.total ?? 0).toFixed(3),
    (o.platform_fee ?? 0).toFixed(3),
    (o.driver_fee_cut ?? 0).toFixed(3),
    o.payment_method ?? "—",
  ]);

  const filterDesc = [
    params.status ? `Statut: ${STATUS_LABELS[params.status] ?? params.status}` : null,
    params.from ? `À partir du: ${new Date(params.from).toLocaleDateString("fr-FR")}` : null,
  ].filter(Boolean).join("  ·  ") || "Toutes les commandes (200 dernières)";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Commandes</h2>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="bg-gray-800 px-3 py-1.5 rounded-lg">
            {totalOrders} commandes
          </span>
          <span className="bg-orange-500/15 text-orange-400 px-3 py-1.5 rounded-lg">
            {totalCommissions.toFixed(3)} TND commissions
          </span>
          <ExportButton
            filename="commandes"
            title="Commandes"
            subtitle={filterDesc}
            columns={exportColumns}
            rows={exportRows}
          />
        </div>
      </div>

      <OrdersTable orders={orders} statusLabels={STATUS_LABELS} currentStatus={params.status} />
    </div>
  );
}
