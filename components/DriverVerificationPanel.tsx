"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldAlert } from "lucide-react";

/**
 * Dossier de vérification d'un livreur, saisi en présentiel au recrutement.
 *
 * Le critère est le CIN ET la date de légalisation à la baladiya. Le scan du
 * contrat est facultatif — c'est une pièce jointe, pas la preuve — et se
 * dépose séparément dans le bucket privé `driver-contracts`.
 *
 * Le CIN n'est affiché QUE sur ce dashboard : ni l'app client ni l'app
 * livreur n'ont de policy sur la table qui le porte.
 */
export interface DriverIdentity {
  cin: string | null;
  contract_signed_at: string | null;
  contract_legalized_at: string | null;
  verified_at: string | null;
}

export default function DriverVerificationPanel({
  driverId,
  identity,
  verified,
  missing,
}: {
  driverId: string;
  identity: DriverIdentity | null;
  verified: boolean;
  missing: string[];
}) {
  const router = useRouter();
  const [cin, setCin] = useState(identity?.cin ?? "");
  const [signed, setSigned] = useState(identity?.contract_signed_at ?? "");
  const [legalized, setLegalized] = useState(
    identity?.contract_legalized_at ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/driver-verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: driverId,
          cin,
          contract_signed_at: signed || null,
          contract_legalized_at: legalized || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: body.error ?? "Échec de l'enregistrement" });
        return;
      }
      setMsg({
        ok: true,
        text: body.verified
          ? "Dossier complet — le livreur peut travailler"
          : "Enregistré. Dossier encore incomplet.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-3">
      <div className="flex items-center gap-2">
        {verified ? (
          <>
            <ShieldCheck size={16} className="text-green-700" />
            <span className="text-sm font-semibold text-green-800">Vérifié</span>
          </>
        ) : (
          <>
            <ShieldAlert size={16} className="text-amber-700" />
            <span className="text-sm font-semibold text-amber-800">
              En attente ({missing.join(" + ")} manquant
              {missing.length > 1 ? "s" : ""})
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="text-xs text-gray-600">
          CIN
          <input
            value={cin}
            onChange={(e) => setCin(e.target.value)}
            placeholder="Numéro de CIN"
            className="mt-1 w-full border rounded-lg p-2 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Contrat signé le
          <input
            type="date"
            value={signed}
            onChange={(e) => setSigned(e.target.value)}
            className="mt-1 w-full border rounded-lg p-2 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Légalisé à la baladiya le
          <input
            type="date"
            value={legalized}
            onChange={(e) => setLegalized(e.target.value)}
            className="mt-1 w-full border rounded-lg p-2 text-sm"
          />
        </label>
      </div>

      <p className="text-xs text-gray-500">
        La date de légalisation vaut la case « contrat signé et légalisé ». Le
        scan est facultatif.
      </p>

      {msg && (
        <p
          className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}
        >
          {msg.text}
        </p>
      )}

      <button
        onClick={save}
        disabled={busy}
        className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
      >
        {busy ? "..." : "Enregistrer le dossier"}
      </button>
    </div>
  );
}
