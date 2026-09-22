"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Plus, Package, Trash2, X } from "lucide-react";

interface Category {
  id: string;
  name_fr: string;
  icon: string;
  color_hex: string;
  sort_order: number;
}

interface Vendor {
  id: string;
  category: string;
  name: string;
  is_open: boolean | null;
  is_ghost_restaurant: boolean | null;
  delivery_fee: number | null;
  created_at: string;
}

export default function VendorsBrowser({
  categories,
  vendors,
  itemCounts,
}: {
  categories: Category[];
  vendors: Vendor[];
  itemCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [active, setActive] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of vendors) c[v.category] = (c[v.category] ?? 0) + 1;
    return c;
  }, [vendors]);

  const shown = active === "all" ? vendors : vendors.filter((v) => v.category === active);
  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  );

  async function createVendor(form: FormData) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: form.get("category"),
        name: form.get("name"),
        description: form.get("description"),
        latitude: form.get("latitude") || null,
        longitude: form.get("longitude") || null,
        delivery_fee: form.get("delivery_fee") || 0,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Erreur");
      return;
    }
    setShowAdd(false);
    router.refresh();
  }

  async function removeVendor(v: Vendor) {
    if (!confirm(`Supprimer « ${v.name} » et tout son catalogue ?`)) return;
    const res = await fetch(`/api/vendors?vendor_id=${v.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setError("Suppression impossible");
  }

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActive("all")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            active === "all"
              ? "bg-white text-gray-900"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Toutes ({vendors.length})
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active === c.id
                ? "bg-white text-gray-900"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {c.icon} {c.name_fr} ({counts[c.id] ?? 0})
          </button>
        ))}
        <button
          onClick={() => setShowAdd(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
        >
          <Plus size={14} />
          Nouvelle boutique
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Boutique</th>
                <th className="px-5 py-3 text-left font-medium">Catégorie</th>
                <th className="px-5 py-3 text-left font-medium">Articles</th>
                <th className="px-5 py-3 text-left font-medium">Livraison</th>
                <th className="px-5 py-3 text-left font-medium">Statut</th>
                <th className="px-5 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                    Aucune boutique dans cette catégorie.
                  </td>
                </tr>
              )}
              {shown.map((v) => {
                const cat = catById[v.category];
                const n = itemCounts[v.id] ?? 0;
                return (
                  <tr
                    key={v.id}
                    className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Store size={14} className="text-gray-500" />
                        <span className="font-medium text-white">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-300">
                      {cat ? `${cat.icon} ${cat.name_fr}` : v.category}
                    </td>
                    <td className="px-5 py-4">
                      <span className={n === 0 ? "text-amber-400" : "text-gray-300"}>
                        {n}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-300">
                      {Number(v.delivery_fee ?? 0).toFixed(3)} TND
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          v.is_open
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {v.is_open ? "Ouverte" : "Fermée"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/vendors/${v.id}/items`}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                        >
                          <Package size={12} />
                          Articles
                        </Link>
                        <button
                          onClick={() => removeVendor(v)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="font-semibold text-white">Nouvelle boutique</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form
              action={createVendor}
              className="p-5 space-y-3"
            >
              <div>
                <label className="block text-xs text-gray-400 mb-1">Catégorie</label>
                <select
                  name="category"
                  required
                  defaultValue={active !== "all" ? active : categories[0]?.id}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name_fr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nom</label>
                <input
                  name="name"
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <input
                  name="description"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Latitude</label>
                  <input
                    name="latitude"
                    type="number"
                    step="any"
                    placeholder="35.6781"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Longitude</label>
                  <input
                    name="longitude"
                    type="number"
                    step="any"
                    placeholder="10.0963"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Frais de livraison (TND)</label>
                <input
                  name="delivery_fee"
                  type="number"
                  step="0.001"
                  defaultValue="3.000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
              >
                {busy ? "Création…" : "Créer"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
