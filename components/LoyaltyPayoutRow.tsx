"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LoyaltyPayoutData {
  id: string;
  milestone_type: "half" | "free";
  amount_owed: number;
  status: "pending" | "settled";
  created_at: string;
  settled_at: string | null;
  driverName: string;
  driverPhone: string | null;
  orderShortId: string;
}

export default function LoyaltyPayoutRow({ payout }: { payout: LoyaltyPayoutData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [settled, setSettled] = useState(payout.status === "settled");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  async function markSettled() {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/loyalty/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payout_id: payout.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");

      setSettled(true);
      setFeedback({ ok: true, msg: "Réglé" });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setFeedback({ ok: false, msg });
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  }

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
      <td className="px-5 py-4">
        <p className="font-medium text-white">{payout.driverName}</p>
        <p className="text-xs text-gray-500">{payout.driverPhone ?? "—"}</p>
      </td>
      <td className="px-5 py-4 text-gray-300 font-mono text-xs">#{payout.orderShortId}</td>
      <td className="px-5 py-4">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            payout.milestone_type === "free"
              ? "bg-purple-500/15 text-purple-400"
              : "bg-blue-500/15 text-blue-400"
          }`}
        >
          {payout.milestone_type === "free" ? "Livraison gratuite (10e)" : "-50% (5e)"}
        </span>
      </td>
      <td className="px-5 py-4 text-orange-400 font-medium">
        {payout.amount_owed.toFixed(3)} TND
      </td>
      <td className="px-5 py-4 text-gray-400 text-xs">
        {new Date(payout.created_at).toLocaleDateString("fr-FR")}
      </td>
      <td className="px-5 py-4">
        {settled ? (
          <span className="text-xs px-2 py-1 rounded-full bg-green-500/15 text-green-400">
            Réglé
          </span>
        ) : (
          <div className="flex flex-col gap-1 items-start">
            <button
              onClick={markSettled}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
            >
              {loading ? "..." : "Marquer comme réglé"}
            </button>
            {feedback && (
              <span className={`text-xs ${feedback.ok ? "text-green-400" : "text-red-400"}`}>
                {feedback.msg}
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
