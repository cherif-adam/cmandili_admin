"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ClientData {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  is_blocked: boolean;
  created_at: string;
  stats: { orderCount: number; totalSpent: number };
}

export default function ClientRow({ client }: { client: ClientData }) {
  const router = useRouter();
  const [isBlocked, setIsBlocked] = useState(client.is_blocked);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  async function toggleBlock() {
    setLoading(true);
    setFeedback(null);
    const newBlocked = !isBlocked;

    try {
      const res = await fetch("/api/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: client.id, blocked: newBlocked }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");

      setIsBlocked(newBlocked);
      setFeedback({ ok: true, msg: newBlocked ? "Client bloqué" : "Client débloqué" });
      router.refresh();
    } catch (err: unknown) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  }

  const joinedDate = new Date(client.created_at).toLocaleDateString("fr-TN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
      <td className="px-5 py-4">
        <p className="font-medium text-white">{client.full_name || "—"}</p>
        <p className="text-xs text-gray-500">{client.phone || "—"}</p>
      </td>
      <td className="px-5 py-4 text-gray-400 text-xs">{client.email || "—"}</td>
      <td className="px-5 py-4 text-gray-300">{client.stats.orderCount}</td>
      <td className="px-5 py-4 text-gray-300">{client.stats.totalSpent.toFixed(3)} TND</td>
      <td className="px-5 py-4">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isBlocked ? "bg-red-500/15 text-red-400" : "bg-green-500/15 text-green-400"
          }`}
        >
          {isBlocked ? "Bloqué" : "Actif"}
        </span>
      </td>
      <td className="px-5 py-4 text-gray-500 text-xs">{joinedDate}</td>
      <td className="px-5 py-4">
        <div className="flex flex-col gap-1 items-start">
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
          {feedback && (
            <span className={`text-xs ${feedback.ok ? "text-green-400" : "text-red-400"}`}>
              {feedback.msg}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
