"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Wallet, Check } from "lucide-react";

interface TopUpButtonProps {
  /** Provide exactly one of driverId / partnerId. */
  driverId?: string;
  partnerId?: string;
  entityName: string;
  currentBalance?: number | null;
}

const QUICK_AMOUNTS = [50, 100, 200];

export default function TopUpButton({
  driverId,
  partnerId,
  entityName,
  currentBalance,
}: TopUpButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Entrez un montant valide");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: driverId,
          partner_id: partnerId,
          amount: value,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      setDone(true);
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setAmount("");
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
      >
        <Wallet size={12} />
        Recharger
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-gray-900 border border-gray-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Wallet size={18} className="text-emerald-400" />
                Recharger le solde
              </h3>
              <button
                onClick={() => !loading && setOpen(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-1">{entityName}</p>
            {typeof currentBalance === "number" && (
              <p className="text-xs text-gray-500 mb-4">
                Solde actuel :{" "}
                <span
                  className={currentBalance <= 0 ? "text-red-400" : "text-gray-300"}
                >
                  {currentBalance.toFixed(3)} TND
                </span>
              </p>
            )}

            {done ? (
              <div className="flex items-center gap-2 text-emerald-400 py-6 justify-center">
                <Check size={20} />
                <span className="font-medium">Solde rechargé</span>
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  {QUICK_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAmount(String(a))}
                      className="flex-1 text-sm py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      {a} TND
                    </button>
                  ))}
                </div>

                <label className="block text-xs text-gray-400 mb-1">
                  Montant (TND)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.000"
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:border-emerald-500 mb-4"
                  autoFocus
                />

                {error && (
                  <p className="text-xs text-red-400 mb-3">{error}</p>
                )}

                <button
                  onClick={submit}
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {loading ? "..." : "Confirmer la recharge"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
