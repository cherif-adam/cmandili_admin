"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, User, Truck, Store } from "lucide-react";

export interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  createdAt: string;
  name: string;
  phone: string | null;
  role: "client" | "driver" | "partner";
}

const STATUS = {
  open: { label: "Ouvert", color: "#ef4444" },
  in_progress: { label: "En cours", color: "#f59e0b" },
  resolved: { label: "Résolu", color: "#10b981" },
  closed: { label: "Fermé", color: "#6b7280" },
} as const;

const ROLE = {
  client: { label: "Client", icon: User },
  driver: { label: "Livreur", icon: Truck },
  partner: { label: "Partenaire", icon: Store },
} as const;

export default function SupportTickets({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | Ticket["status"]>("open");
  const [busy, setBusy] = useState<string | null>(null);

  const shown = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  async function setStatus(id: string, status: Ticket["status"]) {
    setBusy(id);
    const res = await fetch("/api/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket_id: id, status }),
    });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(["open", "in_progress", "resolved", "closed", "all"] as const).map((f) => {
          const active = filter === f;
          const count =
            f === "all" ? tickets.length : tickets.filter((t) => t.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-md px-2.5 py-1 text-[12px] transition-colors"
              style={{
                background: active ? "var(--brand-soft)" : "var(--surface-2)",
                color: active ? "var(--brand-text)" : "var(--text-muted)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {f === "all" ? "Tous" : STATUS[f].label} ({count})
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center text-[13px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Aucun message dans cette catégorie.
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((t) => {
            const s = STATUS[t.status];
            const RoleIcon = ROLE[t.role].icon;
            return (
              <div
                key={t.id}
                className="rounded-lg p-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: `${s.color}22`, color: s.color }}
                      >
                        {s.label}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-[11px]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        <RoleIcon size={11} />
                        {ROLE[t.role].label}
                      </span>
                      <span className="text-[13px] font-medium">{t.name}</span>
                      {t.phone && (
                        <a
                          href={`tel:${t.phone}`}
                          className="inline-flex items-center gap-1 text-[11px]"
                          style={{ color: "var(--brand-text)" }}
                        >
                          <Phone size={10} />
                          {t.phone}
                        </a>
                      )}
                      <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                        {new Date(t.createdAt).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-[13px] font-semibold">{t.subject}</p>
                    <p
                      className="mt-0.5 whitespace-pre-wrap text-[12.5px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {t.message}
                    </p>
                  </div>

                  <select
                    value={t.status}
                    disabled={busy === t.id}
                    onChange={(e) => setStatus(t.id, e.target.value as Ticket["status"])}
                    className="rounded-md px-2 py-1 text-[12px]"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  >
                    <option value="open">Ouvert</option>
                    <option value="in_progress">En cours</option>
                    <option value="resolved">Résolu</option>
                    <option value="closed">Fermé</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
