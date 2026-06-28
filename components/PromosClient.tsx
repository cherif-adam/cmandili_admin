"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X } from "lucide-react";

export interface PromoCode {
  id: string;
  code: string;
  type: "percentage" | "fixed_amount";
  value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  valid_from: string | null;
  expires_at: string | null;
  is_active: boolean;
  used_count: number;
  created_at: string;
}

interface FormState {
  code: string;
  type: "percentage" | "fixed_amount";
  value: string;
  min_order_amount: string;
  max_uses: string;
  max_uses_per_customer: string;
  valid_from: string;
  expires_at: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  code: "",
  type: "percentage",
  value: "",
  min_order_amount: "",
  max_uses: "",
  max_uses_per_customer: "",
  valid_from: "",
  expires_at: "",
  is_active: true,
};

export default function PromosClient({ promos: initial }: { promos: PromoCode[] }) {
  const router = useRouter();
  const [promos, setPromos] = useState(initial);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function flash(ok: boolean, msg: string) {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 4000);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(p: PromoCode) {
    setEditing(p);
    setForm({
      code: p.code,
      type: p.type,
      value: String(p.value),
      min_order_amount: p.min_order_amount != null ? String(p.min_order_amount) : "",
      max_uses: p.max_uses != null ? String(p.max_uses) : "",
      max_uses_per_customer: p.max_uses_per_customer != null ? String(p.max_uses_per_customer) : "",
      valid_from: p.valid_from ? p.valid_from.slice(0, 16) : "",
      expires_at: p.expires_at ? p.expires_at.slice(0, 16) : "",
      is_active: p.is_active,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
  }

  async function handleSave() {
    if (!form.code.trim() || !form.value) {
      flash(false, "Code et valeur de remise sont requis");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        type: form.type,
        value: form.value,
        min_order_amount: form.min_order_amount || "",
        max_uses: form.max_uses || "",
        max_uses_per_customer: form.max_uses_per_customer || "",
        valid_from: form.valid_from || "",
        expires_at: form.expires_at || "",
        is_active: form.is_active,
        ...(editing ? { id: editing.id } : {}),
      };

      const res = await fetch("/api/promos", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");

      closeModal();
      flash(true, editing ? "Code mis à jour" : "Code créé");
      router.refresh();
    } catch (err: unknown) {
      flash(false, err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(p: PromoCode) {
    const newVal = !p.is_active;
    // Optimistic
    setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: newVal } : x));
    try {
      const res = await fetch("/api/promos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, is_active: newVal }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (err: unknown) {
      // Rollback
      setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: p.is_active } : x));
      flash(false, err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/promos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setPromos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      flash(true, "Code supprimé");
      router.refresh();
    } catch (err: unknown) {
      flash(false, err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeleting(false);
    }
  }

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 placeholder-gray-500";
  const labelCls = "block text-xs text-gray-400 mb-1";

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        {feedback && (
          <span className={`text-sm ${feedback.ok ? "text-green-400" : "text-red-400"}`}>
            {feedback.msg}
          </span>
        )}
        <div className="ml-auto">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} />
            Créer un code promo
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Remise</th>
                <th className="px-5 py-3 font-medium">Min. commande</th>
                <th className="px-5 py-3 font-medium">Utilisations</th>
                <th className="px-5 py-3 font-medium">Limite</th>
                <th className="px-5 py-3 font-medium">Validité</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => {
                const discountLabel = p.type === "percentage"
                  ? `${p.value}%`
                  : `${Number(p.value).toFixed(3)} TND`;
                const validUntil = p.expires_at
                  ? new Date(p.expires_at).toLocaleDateString("fr-TN")
                  : "—";
                const limitLabel = p.max_uses != null ? `${p.used_count} / ${p.max_uses}` : `${p.used_count} / ∞`;
                return (
                  <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono font-semibold text-orange-400">{p.code}</span>
                    </td>
                    <td className="px-5 py-4 text-gray-300">{discountLabel}</td>
                    <td className="px-5 py-4 text-gray-400">
                      {p.min_order_amount != null ? `${Number(p.min_order_amount).toFixed(3)} TND` : "—"}
                    </td>
                    <td className="px-5 py-4 text-gray-300">{limitLabel}</td>
                    <td className="px-5 py-4 text-gray-400">
                      {p.max_uses_per_customer != null ? `${p.max_uses_per_customer}×/client` : "—"}
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{validUntil}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggle(p)}
                        title={p.is_active ? "Désactiver" : "Activer"}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        {p.is_active
                          ? <><ToggleRight size={20} className="text-green-400" /><span className="text-green-400">Actif</span></>
                          : <><ToggleLeft size={20} className="text-gray-500" /><span className="text-gray-500">Inactif</span></>
                        }
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!promos.length && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-500">
                    Aucun code promo. Cliquez sur &quot;Créer un code promo&quot; pour commencer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="font-semibold text-white">
                {editing ? "Modifier le code promo" : "Créer un code promo"}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Code */}
              <div>
                <label className={labelCls}>Code *</label>
                <input
                  className={inputCls}
                  placeholder="BIENVENUE10"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
              </div>

              {/* Discount type + value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Type de remise *</label>
                  <select
                    className={inputCls}
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "percentage" | "fixed_amount" })}
                  >
                    <option value="percentage">Pourcentage (%)</option>
                    <option value="fixed_amount">Montant fixe (TND)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    Valeur * {form.type === "percentage" ? "(%)" : "(TND)"}
                  </label>
                  <input
                    type="number" min="0" step="0.001"
                    className={inputCls}
                    placeholder={form.type === "percentage" ? "10" : "5.000"}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                  />
                </div>
              </div>

              {/* Min order */}
              <div>
                <label className={labelCls}>Montant minimum de commande (TND, optionnel)</label>
                <input
                  type="number" min="0" step="0.001"
                  className={inputCls}
                  placeholder="20.000"
                  value={form.min_order_amount}
                  onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                />
              </div>

              {/* Usage limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Utilisations max totales (optionnel)</label>
                  <input
                    type="number" min="1" step="1"
                    className={inputCls}
                    placeholder="100"
                    value={form.max_uses}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Max par client (optionnel)</label>
                  <input
                    type="number" min="1" step="1"
                    className={inputCls}
                    placeholder="1"
                    value={form.max_uses_per_customer}
                    onChange={(e) => setForm({ ...form, max_uses_per_customer: e.target.value })}
                  />
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Valide à partir du (optionnel)</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Expire le (optionnel)</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={form.expires_at}
                    onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  />
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-300">Actif (visible par les clients)</label>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-white">Supprimer ce code ?</h3>
            <p className="text-sm text-gray-400">
              Le code <span className="font-mono text-orange-400">{deleteTarget.code}</span> sera
              définitivement supprimé. Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
