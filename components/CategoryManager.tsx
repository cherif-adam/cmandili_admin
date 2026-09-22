"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Layers, Eye, EyeOff, Trash2 } from "lucide-react";

export interface CategoryRow {
  id: string;
  name_fr: string;
  icon: string;
  color_hex: string;
  sort_order: number;
  is_active?: boolean;
}

/**
 * Add, reorder, hide or remove the categories the client app's home grid is
 * built from. Because the apps read this table at startup, a category added
 * here appears in the app without shipping a new build.
 */
export default function CategoryManager({
  categories,
  available,
}: {
  categories: CategoryRow[];
  /** False when `vendor_categories` could not be read — the list shown is the
   *  built-in fallback and cannot be edited until the migration has run. */
  available: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(form: FormData) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/vendor-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: String(form.get("id") ?? "").trim().toLowerCase(),
        name_fr: form.get("name_fr"),
        name_en: form.get("name_en"),
        name_ar: form.get("name_ar"),
        icon: form.get("icon"),
        sort_order: form.get("sort_order"),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Erreur");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function toggleActive(c: CategoryRow) {
    const res = await fetch("/api/vendor-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: c.id, is_active: !(c.is_active ?? true) }),
    });
    if (res.ok) router.refresh();
    else setError((await res.json().catch(() => ({}))).error ?? "Erreur");
  }

  async function remove(c: CategoryRow) {
    if (!confirm(`Supprimer la catégorie « ${c.name_fr} » ?`)) return;
    const res = await fetch(`/api/vendor-categories?category_id=${c.id}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
    else setError((await res.json().catch(() => ({}))).error ?? "Erreur");
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-[#12151d]">
      <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-white">
            Catégories de l&apos;application
          </h3>
          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[11px] text-gray-400">
            {categories.length}
          </span>
        </div>
        {available && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30"
          >
            <Plus size={13} />
            Ajouter
          </button>
        )}
      </div>

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 p-4">
        {categories.map((c) => {
          const active = c.is_active ?? true;
          return (
            <div
              key={c.id}
              className={`group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                active
                  ? "border-gray-700 bg-gray-800/60"
                  : "border-gray-800 bg-gray-900/60 opacity-50"
              }`}
            >
              <span className="text-lg leading-none">{c.icon}</span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-tight text-white">
                  {c.name_fr}
                </p>
                <p className="font-mono text-[10px] leading-tight text-gray-500">
                  {c.id}
                </p>
              </div>
              {available && (
                <div className="ml-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => toggleActive(c)}
                    title={active ? "Masquer dans l'app" : "Afficher dans l'app"}
                    className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
                  >
                    {active ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button
                    onClick={() => remove(c)}
                    title="Supprimer"
                    className="rounded p-1 text-gray-400 hover:bg-red-500/20 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!available && (
        <p className="border-t border-gray-800 px-5 py-3 text-xs text-gray-500">
          Liste intégrée par défaut. Lancez la migration pour pouvoir ajouter ou
          modifier des catégories depuis ici.
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
              <h3 className="font-semibold text-white">Nouvelle catégorie</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <form action={add} className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">
                    Identifiant *
                  </label>
                  <input
                    name="id"
                    required
                    placeholder="pharmacie"
                    pattern="[a-z0-9_]+"
                    title="minuscules, chiffres et _ uniquement"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Icône</label>
                  <input
                    name="icon"
                    placeholder="💊"
                    defaultValue="🏪"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">
                  Nom français *
                </label>
                <input
                  name="name_fr"
                  required
                  placeholder="Pharmacie"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Anglais</label>
                  <input
                    name="name_en"
                    placeholder="Pharmacy"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Arabe</label>
                  <input
                    name="name_ar"
                    placeholder="صيدلية"
                    dir="rtl"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">
                  Ordre d&apos;affichage
                </label>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={100}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {busy ? "Création…" : "Créer la catégorie"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
