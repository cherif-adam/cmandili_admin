"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";

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
  driver_id: string | null;
  assigned_driver_id: string | null;
  self_delivery: boolean;
  cancellation_reason: string | null;
  cancelled_by: string | null;
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
const STUCK_THRESHOLD_MS = 5 * 60 * 1000;

function isStuck(order: Order): boolean {
  if (!["ready", "confirmed"].includes(order.status)) return false;
  if (order.driver_id != null) return false;
  return Date.now() - new Date(order.created_at).getTime() > STUCK_THRESHOLD_MS;
}

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

  const stuckCount = orders.filter(isStuck).length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Filter bar */}
      <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2 flex-wrap">
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
        {stuckCount > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 font-medium">
            <AlertTriangle size={13} />
            {stuckCount} bloquée{stuckCount > 1 ? "s" : ""} — sans livreur
          </span>
        )}
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
            {orders.map((o) => {
              const stuck = isStuck(o);
              return (
                <tr
                  key={o.id}
                  className={`border-b border-gray-800 transition-colors ${
                    stuck
                      ? "bg-red-500/5 hover:bg-red-500/10"
                      : "hover:bg-gray-800/40"
                  }`}
                >
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      {stuck && (
                        <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
                      )}
                      {o.id.slice(0, 8).toUpperCase()}
                    </div>
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
                    <div className="flex flex-col gap-1">
                      <span
                        className={`text-xs px-2 py-1 rounded-full w-fit ${
                          STATUS_COLORS[o.status] ?? "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {statusLabels[o.status] ?? o.status}
                      </span>
                      {o.self_delivery && (
                        <span className="text-xs px-2 py-0.5 rounded-full w-fit bg-orange-500/15 text-orange-400 font-medium">
                          Auto-livré
                        </span>
                      )}
                      {stuck && (
                        <span className="text-xs text-red-400 px-2">Sans livreur</span>
                      )}
                      {o.status === "cancelled" && o.cancellation_reason && (
                        <span className="text-xs text-red-400/70 px-1 mt-0.5" title={o.cancellation_reason}>
                          {o.cancelled_by === "customer" ? "Client : " : ""}
                          {o.cancellation_reason}
                        </span>
                      )}
                    </div>
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
              );
            })}
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
