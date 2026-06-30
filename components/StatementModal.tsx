"use client";

import { useState } from "react";
import { X, FileText, Link2, Check } from "lucide-react";

interface OrderSnap {
  id: string;
  date: string;
  label: string;
  amount: number;
  commission: number;
}

interface StatementResult {
  reference_code: string;
  order_count: number;
  total_amount: number;
  total_commission: number;
  orders: OrderSnap[];
}

export interface StatementModalProps {
  entityType: "driver" | "restaurant";
  entityId: string;
  entityName: string;
  entityPhone?: string;
  onClose: () => void;
}

function getDefaultDates() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: firstDay.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export default function StatementModal({
  entityType,
  entityId,
  entityName,
  entityPhone,
  onClose,
}: StatementModalProps) {
  const defaults = getDefaultDates();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo,   setDateTo]   = useState(defaults.to);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [result,   setResult]   = useState<StatementResult | null>(null);
  const [copied,   setCopied]   = useState(false);

  async function generate() {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/releve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type:  entityType,
          entity_id:    entityId,
          entity_name:  entityName,
          entity_phone: entityPhone,
          date_from:    dateFrom,
          date_to:      dateTo,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPDF() {
    if (!result) return;
    const { default: jsPDF }     = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc   = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    const fmtDate  = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR");
    const nowLabel = new Date().toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    // Orange header bar
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, pageW, 10, "F");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Cmandili  —  Relevé officiel", 14, 7);

    // Title
    doc.setTextColor(30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(
      entityType === "driver"
        ? "Relevé de livraisons — Livreur"
        : "Relevé de commandes — Restaurant",
      14, 22
    );

    // Entity block
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(entityName, 14, 32);

    let y = 32;
    if (entityPhone) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(entityPhone, 14, 38);
      y = 38;
    }

    // Meta block
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(`Période : du ${fmtDate(dateFrom)} au ${fmtDate(dateTo)}`, 14, y + 9);
    doc.text(`Référence : ${result.reference_code}`, 14, y + 15);
    doc.text(`Généré le : ${nowLabel}`, 14, y + 21);

    // Divider
    doc.setDrawColor(230);
    doc.line(14, y + 26, pageW - 14, y + 26);

    // Orders table
    const columns = entityType === "driver"
      ? ["N° Commande", "Date", "Restaurant", "Frais livraison (TND)", "Votre commission (TND)"]
      : ["N° Commande", "Date", "Client", "Sous-total (TND)", "Commission plateforme (TND)"];

    const bodyRows: string[][] = result.orders.map((o) => [
      o.id,
      o.date,
      o.label,
      o.amount.toFixed(3),
      o.commission.toFixed(3),
    ]);
    // Totals row appended to body (styled separately via didParseCell)
    bodyRows.push(["", "", "TOTAL", result.total_amount.toFixed(3), result.total_commission.toFixed(3)]);
    const totalRowIdx = bodyRows.length - 1;

    autoTable(doc, {
      head: [columns],
      body: bodyRows,
      startY: y + 32,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      didParseCell: (data) => {
        if (data.row.index === totalRowIdx && data.section === "body") {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [255, 237, 213]; // orange-100
          data.cell.styles.textColor = [180, 70, 0];
        }
      },
      margin: { left: 14, right: 14 },
    });

    // Footer note
    const pageCount = (doc as unknown as { internal: { getNumberOfPages(): number } })
      .internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      const pH = doc.internal.pageSize.getHeight();
      doc.text(
        "Document généré automatiquement par la plateforme Cmandili. Ce relevé fait foi entre les parties.",
        14, pH - 8
      );
      doc.text(`Page ${i}/${pageCount}`, pageW - 14, pH - 8, { align: "right" });
    }

    doc.save(`releve_${result.reference_code}.pdf`);
  }

  function copyLink() {
    if (!result) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/releve/${result.reference_code}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const typeLabel = entityType === "driver" ? "Livreur" : "Restaurant";
  const fmtD = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("fr-FR");

  return (
    /* Fixed overlay — position: fixed escapes the table DOM constraint visually */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h3 className="font-semibold text-white">Générer un relevé</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {typeLabel} : <span className="text-gray-200">{entityName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!result ? (
            /* Phase 1 — pick date range */
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-400 font-medium">Date de début</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-400 font-medium">Date de fin</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2.5">
                  {error}
                </p>
              )}

              <button
                onClick={generate}
                disabled={loading || !dateFrom || !dateTo}
                className="w-full py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Génération en cours…
                  </>
                ) : (
                  <>
                    <FileText size={15} />
                    Générer le relevé
                  </>
                )}
              </button>
            </>
          ) : (
            /* Phase 2 — show result */
            <>
              {/* Summary card */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Référence</span>
                  <span className="font-mono text-sm text-orange-400 font-bold tracking-wide">
                    {result.reference_code}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Période</span>
                  <span className="text-sm text-gray-200">
                    {fmtD(dateFrom)} → {fmtD(dateTo)}
                  </span>
                </div>
                <div className="border-t border-gray-700 pt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xl font-bold text-white">{result.order_count}</p>
                    <p className="text-xs text-gray-500 mt-0.5">commandes</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">
                      {result.total_amount.toFixed(3)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      TND {entityType === "driver" ? "frais" : "CA"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-orange-400">
                      {result.total_commission.toFixed(3)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">TND commission</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={downloadPDF}
                  className="w-full py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                >
                  <FileText size={15} />
                  Télécharger le PDF
                </button>
                <button
                  onClick={copyLink}
                  className="w-full py-2.5 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <Check size={15} className="text-green-400" />
                  ) : (
                    <Link2 size={15} />
                  )}
                  {copied ? "Lien copié !" : "Copier le lien de partage"}
                </button>
              </div>

              <button
                onClick={() => setResult(null)}
                className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors py-1"
              >
                ← Générer pour une autre période
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
