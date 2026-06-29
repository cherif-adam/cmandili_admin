"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatementModal from "@/components/StatementModal";

interface DriverData {
  id: string;
  user_id: string;
  is_online: boolean;
  is_blocked: boolean;
  current_lat: number;
  current_lng: number;
  profile: { full_name: string; phone: string } | null;
  wallet: { balance: number; status: string } | null;
  stats: { count: number; totalFees: number; totalCuts: number };
}

export default function DriverRow({ driver }: { driver: DriverData }) {
  const router = useRouter();
  const [loading,       setLoading]       = useState(false);
  const [isBlocked,     setIsBlocked]     = useState(driver.is_blocked);
  const [feedback,      setFeedback]      = useState<{ ok: boolean; msg: string } | null>(null);
  const [showStatement, setShowStatement] = useState(false);

  async function toggleBlock() {
    setLoading(true);
    setFeedback(null);
    const newBlocked = !isBlocked;

    try {
      const res = await fetch("/api/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driver.id, blocked: newBlocked }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");

      setIsBlocked(newBlocked);
      setFeedback({ ok: true, msg: newBlocked ? "Livreur bloqué" : "Livreur débloqué" });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setFeedback({ ok: false, msg });
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  }

  const name    = driver.profile?.full_name ?? "—";
  const phone   = driver.profile?.phone     ?? "—";
  const balance = driver.wallet?.balance    ?? 0;

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
      {/* StatementModal renders as position:fixed — visually escapes the table */}
      {showStatement && (
        <StatementModal
          entityType="driver"
          entityId={driver.id}
          entityName={name}
          entityPhone={phone !== "—" ? phone : undefined}
          onClose={() => setShowStatement(false)}
        />
      )}

      <td className="px-5 py-4">
        <p className="font-medium text-white">{name}</p>
        <p className="text-xs text-gray-500">{phone}</p>
      </td>
      <td className="px-5 py-4">
        <span
          className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
            driver.is_online
              ? "bg-green-500/15 text-green-400"
              : "bg-gray-700 text-gray-400"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${driver.is_online ? "bg-green-400" : "bg-gray-500"}`}
          />
          {driver.is_online ? "En ligne" : "Hors ligne"}
        </span>
      </td>
      <td className="px-5 py-4 text-gray-300">{driver.stats.count}</td>
      <td className="px-5 py-4 text-gray-300">
        {driver.stats.totalFees.toFixed(3)} TND
      </td>
      <td className="px-5 py-4 text-orange-400 font-medium">
        {driver.stats.totalCuts.toFixed(3)} TND
      </td>
      <td className="px-5 py-4">
        <span className={balance < 0 ? "text-red-400 font-medium" : "text-gray-300"}>
          {balance.toFixed(3)} TND
        </span>
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
        <div className="flex flex-col gap-1 items-start">
          <div className="flex items-center gap-1.5 flex-wrap">
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
            <button
              onClick={() => setShowStatement(true)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              Relevé
            </button>
          </div>
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
