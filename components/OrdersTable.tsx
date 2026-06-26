"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Order {
  id: string;
  status: string;
  created_at: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  platform_fee: number;
  driver_fee_cut: number;
  payment_method: string;
  customer_name: string;
  restaurantName: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400",
  confirmed: "bg-blue-500/15 text-blue-400",
  ready: "bg-purple-500/15 text-purple-400",
  picked_up: "bg-indigo-500/15 text-indigo-400",
  delivered: "bg-green-500/15 text-green-400",
  cancelled: "bg-red-500/15 text-red-400",
};

const ALL_STATUSES = ["pending", "confirmed", "ready", "picked_up", "delivered", "cancelled"];

export default function OrdersTable({
  orders,
  statusLabels,
  currentStatus,
}: {
  orders: Order[];
  statusLabels: Record<string, string>;
  currentStatus?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setStatus(status: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (status) params.set("status", status);
    else params.delete("status");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Filter bar */}
      <div className="px-5 py-3 border-b border-gray-800 flex gap-2 flex-wrap">
        <button
          onClick={() => setStatus(undefined)}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            !currentStatus
              ? "bg-orange-500/20 text-orange-400"
              : "text-gray-400 hover:text-gray-200 bg-gray-800"
          }`}
        >
          Toutes
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              currentStatus === s
                ? "bg-orange-500/20 text-orange-400"
                : "text-gray-400 hover:text-gray-200 bg-gray-800"
            }`}
          >
            {statusLabels[s] ?? s}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
              <th className="px-5 py-3 font-medium">ID</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-5 py-3 font-medium">Restaurant</th>
              <th className="px-5 py-3 font-medium">Statut</th>
              <th className="px-5 py-3 font-medium">Sous-total</th>
              <th className="px-5 py-3 font-medium">Livraison</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Commission resto</th>
              <th className="px-5 py-3 font-medium">Commission livreur</th>
              <th className="px-5 py-3 font-medium">Paiement</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors"
              >
                <td className="px-5 py-3 text-gray-500 font-mono text-xs">
                  {o.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(o.created_at).toLocaleDateString("fr-TN", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-5 py-3 text-gray-300">{o.customer_name}</td>
                <td className="px-5 py-3 text-gray-300">{o.restaurantName}</td>
                <td className="px-5 py-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[o.status] ?? "bg-gray-700 text-gray-400"}`}
                  >
                    {statusLabels[o.status] ?? o.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-300">
                  {(o.subtotal ?? 0).toFixed(3)}
                </td>
                <td className="px-5 py-3 text-gray-300">
                  {(o.delivery_fee ?? 0).toFixed(3)}
                </td>
                <td className="px-5 py-3 text-white font-medium">
                  {(o.total ?? 0).toFixed(3)}
                </td>
                <td className="px-5 py-3 text-orange-400">
                  {(o.platform_fee ?? 0).toFixed(3)}
                </td>
                <td className="px-5 py-3 text-blue-400">
                  {(o.driver_fee_cut ?? 0).toFixed(3)}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs capitalize">
                  {o.payment_method ?? "—"}
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={11} className="px-5 py-8 text-center text-gray-500">
                  Aucune commande trouvée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
