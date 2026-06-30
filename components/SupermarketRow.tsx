"use client";

import { useState } from "react";
import Link from "next/link";
import { Ghost, ShoppingCart } from "lucide-react";

interface SupermarketData {
  id: string;
  name: string;
  is_ghost_restaurant?: boolean;
  stats: { count: number; totalRevenue: number };
}

export default function SupermarketRow({ supermarket: s }: { supermarket: SupermarketData }) {
  const [ghostLoading, setGhostLoading] = useState(false);
  const [isGhost, setIsGhost] = useState(s.is_ghost_restaurant ?? true);

  async function toggleGhost() {
    setGhostLoading(true);
    const newVal = !isGhost;
    const res = await fetch("/api/supermarkets/toggle-ghost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supermarket_id: s.id, is_ghost: newVal }),
    });
    if (res.ok) {
      setIsGhost(newVal);
    }
    setGhostLoading(false);
  }

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <p className="font-medium text-white">{s.name}</p>
          {isGhost && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-medium">
              <Ghost size={11} />
              Fantôme
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-4 text-gray-300">{s.stats.count}</td>
      <td className="px-5 py-4 text-gray-300">{s.stats.totalRevenue.toFixed(3)} TND</td>
      <td className="px-5 py-4">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isGhost
              ? "bg-purple-500/15 text-purple-400"
              : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {isGhost ? "Direct livreur" : "Partenaire"}
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

          {/* Grocery menu management — only useful for ghost supermarkets */}
          {isGhost && (
            <Link
              href={`/dashboard/supermarkets/${s.id}/menu`}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              <ShoppingCart size={12} />
              Produits
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}
