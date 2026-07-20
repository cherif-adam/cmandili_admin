"use client";

import { useState } from "react";
import { MessageCircle, Copy, Check } from "lucide-react";

// Strip any prefix and normalize to international format for wa.me
function normalizeForWhatsApp(raw: string): string {
  let digits = raw.replace(/[\s\-().+]/g, "");
  if (digits.startsWith("00216")) digits = digits.slice(5);
  else if (digits.startsWith("216")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return "216" + digits;
}

export default function ContactActions({ phone }: { phone?: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!phone) return null;

  const waNumber = normalizeForWhatsApp(phone);

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(phone!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available (non-https dev env, etc.)
    }
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <a
        href={`https://wa.me/${waNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Ouvrir WhatsApp"
        className="inline-flex items-center justify-center w-6 h-6 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
      >
        <MessageCircle size={12} />
      </a>
      <button
        onClick={copyPhone}
        title="Copier le numéro"
        className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
      >
        {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      </button>
    </div>
  );
}
