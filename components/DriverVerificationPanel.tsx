"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  MAX_SCAN_BYTES,
  SCAN_ACCEPT,
  scanSizeError,
} from "@/lib/driver-verification";

/**
 * Dossier de vérification d'un livreur, saisi en présentiel au recrutement.
 *
 * TROIS PIÈCES, toutes obligatoires : le CIN, la date de légalisation à la
 * baladiya, et le scan du contrat signé et légalisé. Le scan n'est plus une
 * pièce jointe facultative — une date saisie à la main n'atteste rien, c'est
 * le document tamponné qui vaut preuve devant un assureur ou une plainte.
 *
 * Le scan vit dans le bucket PRIVÉ driver-contracts et ne s'ouvre que par une
 * URL signée de deux minutes, demandée au serveur au moment du clic. Aucune
 * URL n'est rendue avec la page : elle expirerait, et surtout elle
 * transformerait le HTML de cette page en jeton d'accès au document.
 *
 * Un remplacement n'écrase RIEN : le serveur écrit un nouveau chemin
 * horodaté, l'ancien fichier reste dans le bucket, et le remplacement est
 * inscrit au journal d'audit avec les deux chemins.
 *
 * Le CIN et le contrat ne sont affichés QUE sur ce dashboard : ni l'app client
 * ni l'app livreur n'ont de policy sur la table qui les porte.
 */
/// Les quatre derniers champs sont OPTIONNELS : quand les colonnes de dossier
/// manquent encore en base, la page se replie sur un select reduit et ne
/// ramene que le CIN. Absent et null se traitent pareil — « non renseigne ».
export interface DriverIdentity {
  cin: string | null;
  contract_signed_at?: string | null;
  contract_legalized_at?: string | null;
  contract_scan_path?: string | null;
  verified_at?: string | null;
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

  const [uploading, setUploading] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const hasScan = Boolean(identity?.contract_scan_path);
  // driver_identity.cin est NOT NULL : sans fiche, le serveur refuse le dépôt.
  // On le dit avant le clic plutôt qu'après l'attente du téléversement.
  const hasRecord = Boolean(identity);

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

  async function uploadScan(file: File) {
    // Contrôle côté navigateur AVANT l'envoi : refuser 40 Mo après deux
    // minutes d'attente, c'est deux minutes perdues. Le serveur revérifie —
    // c'est lui qui décide.
    const sizeError = scanSizeError(file.size);
    if (sizeError) {
      setScanMsg({ ok: false, text: sizeError });
      return;
    }

    setUploading(true);
    setScanMsg(null);
    try {
      const form = new FormData();
      form.append("driver_id", driverId);
      form.append("file", file);
      const res = await fetch("/api/driver-verification/scan", {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!res.ok) {
        setScanMsg({ ok: false, text: body.error ?? "Dépôt impossible" });
        return;
      }
      setScanMsg({
        ok: true,
        text: body.verified
          ? body.replaced
            ? "Scan remplacé — l'ancien est conservé. Dossier complet."
            : "Scan déposé. Dossier complet — le livreur peut travailler."
          : body.replaced
            ? "Scan remplacé — l'ancien est conservé. Dossier encore incomplet."
            : "Scan déposé. Dossier encore incomplet.",
      });
      router.refresh();
    } catch {
      setScanMsg({ ok: false, text: "Dépôt impossible : réseau indisponible." });
    } finally {
      setUploading(false);
      // Le même fichier doit pouvoir être renvoyé après une erreur : sans
      // remise à zéro, l'input ne déclenche plus rien sur une valeur identique.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function viewScan() {
    setScanMsg(null);
    try {
      const res = await fetch(
        `/api/driver-verification/scan?driver_id=${encodeURIComponent(driverId)}`
      );
      const body = await res.json();
      if (!res.ok || !body.url) {
        setScanMsg({
          ok: false,
          text: body.error ?? "Le contrat n'a pas pu être ouvert.",
        });
        return;
      }
      // noopener : le document s'ouvre dans un onglet qui n'a aucune prise sur
      // celui du dashboard.
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch {
      setScanMsg({ ok: false, text: "Réseau indisponible." });
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
              En attente ({missing.join(" / ")} manquant
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
        Les trois pièces sont exigées : le CIN, la date de légalisation et le
        scan du contrat.
      </p>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>
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

      {/* ── Scan du contrat ───────────────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <FileCheck2
            size={15}
            className={hasScan ? "text-green-700" : "text-gray-400"}
          />
          <span className="text-sm font-medium">
            Scan du contrat signé et légalisé
          </span>
          {!hasScan && (
            <span className="text-xs text-amber-800">— manquant</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasScan && (
            <button
              onClick={viewScan}
              className="px-3 py-2 rounded-lg border text-sm inline-flex items-center gap-1.5 hover:bg-gray-50"
            >
              <ExternalLink size={14} />
              Voir le contrat
            </button>
          )}

          <label
            className={`px-3 py-2 rounded-lg border text-sm inline-flex items-center gap-1.5 ${
              uploading || !hasRecord
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer hover:bg-gray-50"
            }`}
          >
            <Upload size={14} />
            {uploading
              ? "Envoi…"
              : hasScan
                ? "Remplacer le scan"
                : "Déposer le scan"}
            <input
              ref={fileRef}
              type="file"
              accept={SCAN_ACCEPT}
              disabled={uploading || !hasRecord}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadScan(file);
              }}
              className="hidden"
            />
          </label>
        </div>

        <p className="text-xs text-gray-500">
          PDF ou photo (JPEG, PNG, WebP), {MAX_SCAN_BYTES / (1024 * 1024)} Mo
          maximum. Un HEIC d&apos;iPhone doit être converti avant l&apos;envoi.
          {hasScan &&
            " Remplacer conserve l'ancien fichier : rien n'est écrasé."}
          {!hasRecord && " Renseignez d'abord le CIN pour créer la fiche."}
        </p>

        {scanMsg && (
          <p
            className={`text-sm ${scanMsg.ok ? "text-green-700" : "text-red-600"}`}
          >
            {scanMsg.text}
          </p>
        )}
      </div>
    </div>
  );
}
