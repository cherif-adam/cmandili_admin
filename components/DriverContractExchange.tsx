"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Send, XCircle } from "lucide-react";
import { MAX_SCAN_BYTES, scanSizeError } from "@/lib/driver-verification";
import { CONTRACT_STATUS_LABEL, DriverContract } from "@/lib/driver-contract";

/**
 * Le contrat qui circule dans l'appli :
 *   1. l'admin envoie le PDF à signer ;
 *   2. le livreur le signe, le fait légaliser à la baladiya et renvoie une
 *      photo depuis l'appli (Profil > Mon contrat) ;
 *   3. l'admin la regarde et la valide (elle devient le scan du dossier) ou
 *      la refuse avec un motif que le livreur voit.
 */
export default function DriverContractExchange({
  driverId,
  contract,
  hasRecord,
}: {
  driverId: string;
  contract: DriverContract | null;
  hasRecord: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(file: File) {
    const sizeError = scanSizeError(file.size);
    if (sizeError) {
      setMsg({ ok: false, text: sizeError });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("driver_id", driverId);
      form.append("file", file);
      const res = await fetch("/api/driver-contract", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: body.error ?? "Envoi impossible" });
        return;
      }
      setMsg({ ok: true, text: "Contrat envoyé au livreur." });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Envoi impossible : réseau indisponible." });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function view(which: "to_sign" | "signed") {
    setMsg(null);
    try {
      const res = await fetch(
        `/api/driver-contract?driver_id=${encodeURIComponent(driverId)}&which=${which}`
      );
      const body = await res.json();
      if (!res.ok || !body.url) {
        setMsg({ ok: false, text: body.error ?? "Le fichier n'a pas pu être ouvert." });
        return;
      }
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch {
      setMsg({ ok: false, text: "Réseau indisponible." });
    }
  }

  async function review(action: "approve" | "reject") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/driver-contract", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId, action, note }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: body.error ?? "Échec" });
        return;
      }
      setMsg({
        ok: true,
        text:
          action === "reject"
            ? "Refusé — le livreur a été prévenu."
            : body.verified
              ? "Validé. Dossier complet — le livreur peut travailler."
              : "Validé. La photo est maintenant le scan du dossier.",
      });
      setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-gray-100 pt-3 space-y-2">
      <div className="flex items-center gap-2">
        <Send size={15} className="text-gray-500" />
        <span className="text-sm font-medium">Contrat envoyé au livreur (dans l&apos;appli)</span>
      </div>

      <p className="text-xs text-gray-600">
        {contract ? CONTRACT_STATUS_LABEL[contract.status] : "Aucun contrat envoyé."}
        {contract?.status === "rejected" && contract.admin_note
          ? ` Motif : ${contract.admin_note}`
          : ""}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`px-3 py-2 rounded-lg border text-sm inline-flex items-center gap-1.5 ${
            busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"
          }`}
        >
          <Send size={14} />
          {contract ? "Renvoyer un contrat (PDF)" : "Envoyer le contrat (PDF)"}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) send(file);
            }}
            className="hidden"
          />
        </label>

        {contract?.to_sign_path && (
          <button
            onClick={() => view("to_sign")}
            className="px-3 py-2 rounded-lg border text-sm inline-flex items-center gap-1.5 hover:bg-gray-50"
          >
            <ExternalLink size={14} />
            Contrat envoyé
          </button>
        )}

        {contract?.signed_path && (
          <button
            onClick={() => view("signed")}
            className="px-3 py-2 rounded-lg border text-sm inline-flex items-center gap-1.5 hover:bg-gray-50"
          >
            <ExternalLink size={14} />
            Photo renvoyée par le livreur
          </button>
        )}
      </div>

      {contract?.status === "submitted" && (
        <div className="space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motif si vous refusez (ex. : tampon de la baladiya illisible)"
            className="w-full border rounded-lg p-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => review("approve")}
              disabled={busy || !hasRecord}
              className="px-3 py-2 rounded-lg bg-green-700 text-white text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              Valider
            </button>
            <button
              onClick={() => review("reject")}
              disabled={busy || !note.trim()}
              className="px-3 py-2 rounded-lg bg-red-700 text-white text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <XCircle size={14} />
              Refuser
            </button>
          </div>
          {!hasRecord && (
            <p className="text-xs text-amber-800">
              Renseignez d&apos;abord le CIN (« Enregistrer le dossier ») pour pouvoir valider.
            </p>
          )}
          <p className="text-xs text-gray-500">
            Valider fait de cette photo le scan du dossier. Pensez aussi à saisir la date de
            légalisation à la baladiya.
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500">
        PDF, {MAX_SCAN_BYTES / (1024 * 1024)} Mo maximum. Le livreur est prévenu dans son appli.
      </p>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>
      )}
    </div>
  );
}
