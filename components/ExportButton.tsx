"use client";

import { useState, useRef, useEffect } from "react";
import { Download } from "lucide-react";

export interface ExportConfig {
  filename: string;       // base filename without extension
  title: string;          // shown in PDF header (e.g. "Commandes")
  subtitle?: string;      // e.g. "30 derniers jours" or active filters
  columns: string[];      // column headers
  rows: string[][];       // all cells pre-formatted as strings
}

export default function ExportButton({ filename, title, subtitle, columns, rows }: ExportConfig) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function exportCSV() {
    const dateFile = new Date().toLocaleDateString("fr-FR").replace(/\//g, "-");
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = columns.map(escape).join(",");
    const body = rows.map((row) => row.map(escape).join(",")).join("\n");
    // BOM (﻿) ensures Excel/LibreOffice opens with correct UTF-8 encoding
    const blob = new Blob(["﻿" + header + "\n" + body], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cmandili_${filename}_${dateFile}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  async function exportPDF() {
    // Dynamic import: jsPDF only loads when user actually clicks PDF — zero initial bundle cost
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const landscape = columns.length > 6;
    const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm" });
    const dateDisplay = new Date().toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    });
    const dateFile = new Date().toLocaleDateString("fr-FR").replace(/\//g, "-");
    const pageW = doc.internal.pageSize.getWidth();

    // Orange accent bar
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, pageW, 10, "F");

    // Brand + title
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Cmandili  —  Administration", 14, 7);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, 20);

    let y = 27;
    if (subtitle) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(subtitle, 14, y);
      y += 6;
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130, 130, 130);
    doc.text(`Exporté le ${dateDisplay}  ·  ${rows.length} entrée${rows.length !== 1 ? "s" : ""}`, 14, y);

    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: y + 6,
      styles: { fontSize: 7.5, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: 14, right: 14 },
    });

    // Page numbers
    const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(160);
      doc.text(
        `Page ${i} / ${pageCount}`,
        pageW - 14,
        doc.internal.pageSize.getHeight() - 6,
        { align: "right" }
      );
    }

    doc.save(`cmandili_${filename}_${dateFile}.pdf`);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-700"
      >
        <Download size={15} />
        Exporter
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-20 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-[170px]">
          <button
            onClick={exportCSV}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white text-left transition-colors"
          >
            <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-mono font-bold">CSV</span>
            Exporter en CSV
          </button>
          <div className="border-t border-gray-700" />
          <button
            onClick={exportPDF}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white text-left transition-colors"
          >
            <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-mono font-bold">PDF</span>
            Exporter en PDF
          </button>
        </div>
      )}
    </div>
  );
}
