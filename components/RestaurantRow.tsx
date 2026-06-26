"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ghost, UtensilsCrossed } from "lucide-react";

interface RestaurantData {
  id: string;
  name: string;
  is_ghost_restaurant?: boolean;
  partner: { user_id: string; commission_rate: number | null } | null;
  wallet: { balance: number; status: string } | null;
  stats: { count: number; totalRevenue: number; totalCommissions: number };
}

export default function RestaurantRow({ restaurant: r }: { restaurant: RestaurantData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [ghostLoading, setGhostLoading] = useState(false);
  const [isGhost, setIsGhost] = useState(r.is_ghost_restaurant ?? false);
  const isBlocked = r.wallet?.status === "blocked";

  async function toggleBlock() {
    if (!r.partner?.user_id) return;
    setLoading(true);
    const newStatus = isBlocked ? "active" : "blocked";
    await fetch("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: r.partner.user_id, status: newStatus, balance: r.wallet?.balance ?? 0 }),
    });
    router.refresh();
    setLoading(false);
  }

  async function toggleGhost() {
    setGhostLoading(true);
    const newVal = !isGhost;
    const res = await fetch("/api/restaurants/toggle-ghost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: r.id, is_ghost: newVal }),
    });
    if (res.ok) {
      setIsGhost(newVal);
    }
    setGhostLoading(false);
  }

  const balance = r.wallet?.balance ?? null;

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <p className="font-medium text-white">{r.name}</p>
          {isGhost && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-medium">
              <Ghost size={11} />
              Fantôme
            </span>
          )}
        </div>
        {r.partner?.commission_rate && (
          <p className="text-xs text-gray-500">
            Taux : {(r.partner.commission_rate * 100).toFixed(0)}%
          </p>
        )}
      </td>
      <td className="px-5 py-4 text-gray-300">{r.stats.count}</td>
      <td className="px-5 py-4 text-gray-300">{r.stats.totalRevenue.toFixed(3)} TND</td>
      <td className="px-5 py-4 text-orange-400 font-medium">
        {r.stats.totalCommissions.toFixed(3)} TND
      </td>
      <td className="px-5 py-4">
        {balance !== null ? (
          <span className={balance < 0 ? "text-red-400 font-medium" : "text-gray-300"}>
            {balance.toFixed(3)} TND
          </span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="px-5 py-4">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isBlocked
              ? "bg-red-500/15 text-red-400"
              : "bg-green-500/15 text-green-400"
          }`}
        >
          {isBlocked ? "Bloqué" : "Actif"}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Ghost toggle */}
          <button
            onClick={toggleGhost}
            disabled={ghostLoading}
            title={isGhost ? "Désactiver le mode fantôme" : "Activer le mode fantôme"}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              isGhost
                ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
          >
            <Ghost size={12} />
            {ghostLoading ? "..." : isGhost ? "Fantôme ON" : "Fantôme"}
          </button>

          {/* Menu management — only useful for ghost restaurants */}
          {isGhost && (
            <Link
              href={`/dashboard/restaurants/${r.id}/menu`}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              <UtensilsCrossed size={12} />
              Menu
            </Link>
          )}

          {/* Block/unblock — only if there is a partner account */}
          {r.partner ? (
            <button
              onClick={toggleBlock}
              disabled={loading}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                isBlocked
                  ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              }`}
            >
              {loading ? "..." : isBlocked ? "Débloquer" : "Bloquer"}
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
