"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RestaurantData {
  id: string;
  name: string;
  partner: { user_id: string; commission_rate: number | null } | null;
  wallet: { balance: number; status: string } | null;
  stats: { count: number; totalRevenue: number; totalCommissions: number };
}

export default function RestaurantRow({ restaurant: r }: { restaurant: RestaurantData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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

  const balance = r.wallet?.balance ?? null;

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
      <td className="px-5 py-4">
        <p className="font-medium text-white">{r.name}</p>
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
        {r.partner ? (
          <button
            onClick={toggleBlock}
            disabled={loading}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              isBlocked
                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
            }`}
          >
            {loading ? "..." : isBlocked ? "Débloquer" : "Bloquer"}
          </button>
        ) : (
          <span className="text-xs text-gray-600">Pas de partenaire</span>
        )}
      </td>
    </tr>
  );
}
