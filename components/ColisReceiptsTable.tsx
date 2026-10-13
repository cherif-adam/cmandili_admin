"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileDown, Lock, MapPin, ShieldCheck, ShieldX } from "lucide-react";

export interface ColisReceipt {
  order_id: string;
  sender_name: string | null;
  sender_phone: string | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_plate: string | null;
  driver_cin: string | null;
  description: string | null;
  declared_value: number | null;
  delivery_mode: string;
  receiver_label: string | null;
  no_code_accepted_at: string | null;
  code_attempts: number;
  code_locked_at: string | null;
  pickup_at: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_url: string | null;
  delivery_at: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_distance_m: number | null;
  delivery_url: string | null;
  code_verified: boolean | null;
  admin_override_reason: string | null;
  admin_override_at: string | null;
  proof_status: string;
  order_status: string | null;
  delivered_at: string | null;
  disputes_on_order: number;
  disputes_by_customer: number;
  disputes_by_driver: number;
}

const PROOF_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: "En attente", cls: "bg-gray-100 text-gray-700" },
  pickup_only: { text: "Prise en charge", cls: "bg-blue-100 text-blue-800" },
  complete: { text: "Complète", cls: "bg-green-100 text-green-800" },
  missing: { text: "Manquante", cls: "bg-red-100 text-red-800" },
};

function dt(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("fr-FR", { timeZone: "Africa/Tunis" });
}

export default function ColisReceiptsTable({
  receipts,
}: {
  receipts: ColisReceipt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function forceClose(orderId: string) {
    if (!reason.trim()) {
      setError("Le motif est obligatoire.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/colis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, reason: reason.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "La clôture a échoué.");
        return;
      }
      setClosing(null);
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!receipts.length) {
    return (
      <p className="text-gray-500 text-sm">Aucun bon de prise en charge.</p>
    );
  }

  return (
    <div className="space-y-3">
      {receipts.map((r) => {
        const badge = PROOF_LABEL[r.proof_status] ?? PROOF_LABEL.pending;
        const expanded = open === r.order_id;
        return (
          <div
            key={r.order_id}
            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            <button
              onClick={() => setOpen(expanded ? null : r.order_id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50"
            >
              <span className="font-mono text-xs text-gray-500">
                #{r.order_id.slice(0, 8).toUpperCase()}
              </span>
              <span className="flex-1 truncate text-sm">
                {r.description ?? "—"}
              </span>
              {r.code_locked_at && (
                <span className="flex items-center gap-1 text-xs text-red-700">
                  <Lock size={13} /> bloqué
                </span>
              )}
              {r.disputes_on_order > 0 && (
                <span className="flex items-center gap-1 text-xs text-orange-700">
                  <AlertTriangle size={13} /> {r.disputes_on_order}
                </span>
              )}
              <span className={`text-xs px-2 py-1 rounded-full ${badge.cls}`}>
                {badge.text}
              </span>
            </button>

            {expanded && (
              <div className="border-t border-gray-100 p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <Row label="Expéditeur" value={r.sender_name ?? "—"} />
                    <Row label="Téléphone" value={r.sender_phone ?? "—"} />
                    <Row
                      label="Valeur déclarée"
                      value={
                        r.declared_value == null
                          ? "—"
                          : `${Number(r.declared_value).toFixed(3)} TND`
                      }
                    />
                    <Row
                      label="Mode"
                      value={
                        r.delivery_mode === "no_code"
                          ? `Sans code — remis à ${r.receiver_label ?? "?"}`
                          : "Code à 4 chiffres"
                      }
                    />
                    {r.delivery_mode === "no_code" && (
                      <Row
                        label="Accepté le"
                        value={dt(r.no_code_accepted_at)}
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Row label="Livreur" value={r.driver_name ?? "—"} />
                    <Row label="Plaque" value={r.driver_plate ?? "—"} />
                    {/* Le CIN n'apparaît QUE sur ce dashboard. Ni l'app
                        client ni l'app livreur n'ont de policy sur la table
                        qui le porte. */}
                    <Row label="CIN" value={r.driver_cin ?? "non renseigné"} />
                    <Row
                      label="Essais de code"
                      value={`${r.code_attempts} / 5${
                        r.code_locked_at ? " — bloqué" : ""
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Proof
                    title="Prise en charge"
                    at={r.pickup_at}
                    lat={r.pickup_lat}
                    lng={r.pickup_lng}
                    url={r.pickup_url}
                  />
                  <Proof
                    title="Remise"
                    at={r.delivery_at}
                    lat={r.delivery_lat}
                    lng={r.delivery_lng}
                    url={r.delivery_url}
                    extra={
                      <>
                        {r.delivery_distance_m != null && (
                          <p className="text-xs text-gray-600">
                            {r.delivery_distance_m} m de l&apos;adresse
                          </p>
                        )}
                        <p className="text-xs flex items-center gap-1">
                          {r.code_verified ? (
                            <>
                              <ShieldCheck size={13} className="text-green-700" />
                              <span className="text-green-700">
                                Code vérifié
                              </span>
                            </>
                          ) : (
                            <>
                              <ShieldX size={13} className="text-orange-700" />
                              <span className="text-orange-700">
                                {r.delivery_mode === "no_code"
                                  ? "Sans code (accepté par l'expéditeur)"
                                  : "Code non vérifié"}
                              </span>
                            </>
                          )}
                        </p>
                      </>
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                  <span>
                    Litiges de ce client : <b>{r.disputes_by_customer}</b>
                  </span>
                  <span>
                    Litiges de ce livreur : <b>{r.disputes_by_driver}</b>
                  </span>
                </div>

                {r.admin_override_at ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
                    <p className="font-semibold text-amber-900">
                      Clôturée par un administrateur le{" "}
                      {dt(r.admin_override_at)}
                    </p>
                    <p className="text-amber-800 mt-1">
                      {r.admin_override_reason}
                    </p>
                  </div>
                ) : closing === r.order_id ? (
                  <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder="Motif de la clôture — obligatoire, conservé avec le bon"
                      className="w-full border rounded-lg p-2 text-sm"
                    />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        disabled={busy}
                        onClick={() => forceClose(r.order_id)}
                        className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50"
                      >
                        {busy ? "..." : "Clôturer la livraison"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setClosing(null);
                          setError(null);
                        }}
                        className="px-3 py-2 rounded-lg border text-sm"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {/* Pièce de preuve pour un litige, un assureur ou une
                        plainte. Un lien, pas un fetch : le navigateur gère le
                        téléchargement, et la route exige déjà la session
                        admin (requireAdmin). Disponible sur TOUT bon, même
                        incomplet — un bon dont les preuves manquent est
                        précisément celui qu'un litige réclame, et le PDF
                        écrit « Non enregistré » là où le serveur n'a rien. */}
                    <a
                      href={`/api/colis/pdf?order_id=${encodeURIComponent(r.order_id)}`}
                      className="px-3 py-2 rounded-lg border text-sm inline-flex items-center gap-1.5 hover:bg-gray-50"
                    >
                      <FileDown className="w-4 h-4" />
                      Télécharger le bon (PDF)
                    </a>
                    {r.order_status !== "delivered" && (
                      <button
                        onClick={() => {
                          setClosing(r.order_id);
                          setReason("");
                        }}
                        className="px-3 py-2 rounded-lg border border-red-300 text-red-700 text-sm"
                      >
                        Clôturer de force
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex gap-2">
      <span className="text-gray-500 w-32 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

function Proof({
  title,
  at,
  lat,
  lng,
  url,
  extra,
}: {
  title: string;
  at: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-gray-600">{dt(at)}</p>
      {lat != null && lng != null && (
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 flex items-center gap-1"
        >
          <MapPin size={12} /> {lat.toFixed(5)}, {lng.toFixed(5)}
        </a>
      )}
      {extra}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title}
          className="mt-1 rounded-lg border w-full max-h-56 object-cover"
        />
      ) : (
        <p className="text-xs text-gray-400 mt-1">Pas de photo</p>
      )}
    </div>
  );
}
