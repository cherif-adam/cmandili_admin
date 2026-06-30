"use client";

import { useState } from "react";

interface Props {
  restaurantRate: number;
  driverRate: number;
}

export default function SettingsForm({ restaurantRate, driverRate }: Props) {
  const [restPct, setRestPct] = useState((restaurantRate * 100).toFixed(2));
  const [drivPct, setDrivPct] = useState((driverRate * 100).toFixed(2));
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const rr = parseFloat(restPct) / 100;
    const dr = parseFloat(drivPct) / 100;

    if (isNaN(rr) || isNaN(dr) || rr <= 0 || rr >= 1 || dr <= 0 || dr >= 1) {
      setFeedback({ ok: false, msg: "Les taux doivent être entre 0 % et 100 % (exclus)" });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_rate: rr, driver_rate: dr }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      setFeedback({ ok: true, msg: "Paramètres enregistrés. Les nouvelles commandes utiliseront ces taux." });
    } catch (err: unknown) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Restaurant commission */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <div>
            <h3 className="font-semibold text-white">Commission restaurants</h3>
            <p className="text-xs text-gray-400 mt-1">
              Prélevée sur le sous-total de chaque commande food/supermarché.
              La valeur enregistrée s&apos;applique uniquement aux nouvelles commandes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="99.99"
              value={restPct}
              onChange={(e) => setRestPct(e.target.value)}
              className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
            />
            <span className="text-gray-400 text-sm">%</span>
          </div>
          <p className="text-xs text-gray-500">
            Taux actuel en DB : {(restaurantRate * 100).toFixed(2)} %
          </p>
        </div>

        {/* Driver commission */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <div>
            <h3 className="font-semibold text-white">Commission livreurs</h3>
            <p className="text-xs text-gray-400 mt-1">
              Prélevée sur les frais de livraison de chaque commande.
              La valeur enregistrée s&apos;applique uniquement aux nouvelles commandes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="99.99"
              value={drivPct}
              onChange={(e) => setDrivPct(e.target.value)}
              className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
            />
            <span className="text-gray-400 text-sm">%</span>
          </div>
          <p className="text-xs text-gray-500">
            Taux actuel en DB : {(driverRate * 100).toFixed(2)} %
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? "Enregistrement…" : "Enregistrer les paramètres"}
        </button>
        {feedback && (
          <span className={`text-sm ${feedback.ok ? "text-green-400" : "text-red-400"}`}>
            {feedback.msg}
          </span>
        )}
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
        <p className="text-xs text-yellow-400">
          <strong>Important :</strong> modifier ces taux n&apos;affecte pas les commandes déjà livrées.
          Les montants <code>platform_fee</code> et <code>driver_fee_cut</code> sont calculés et
          figés au moment de la livraison.
        </p>
      </div>
    </form>
  );
}
