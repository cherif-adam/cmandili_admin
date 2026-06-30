"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden flex items-center gap-2 bg-white/20 text-white text-sm px-4 py-2 rounded-lg hover:bg-white/30 transition-colors"
    >
      <Printer size={15} />
      Imprimer
    </button>
  );
}
