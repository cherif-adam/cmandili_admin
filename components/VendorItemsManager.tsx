"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";

interface Item {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  unit: string | null;
  is_available: boolean | null;
}

export default function VendorItemsManager({
  vendorId,
  initialItems,
}: {
  vendorId: string;
  initialItems: Item[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addItem(form: FormData) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/vendors/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendor_id: vendorId,
        name: form.get("name"),
        description: form.get("description"),
        price: form.get("price"),
        category: form.get("category"),
        unit: form.get("unit"),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Erreur");
      return;
    }
    router.refresh();
  }

  async function toggleAvailable(item: Item) {
    const res = await fetch("/api/vendors/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.id, is_available: !item.is_available }),
    });
    if (res.ok) router.refresh();
  }

  async function removeItem(item: Item) {
    if (!confirm(`Supprimer « ${item.name} » ?`)) return;
    const res = await fetch(`/api/vendors/items?item_id=${item.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  // Group by section so a long catalogue stays readable.
  const grouped: Record<string, Item[]> = {};
  for (const it of initialItems) {
    const key = it.category?.trim() || "Articles";
    (grouped[key] ??= []).push(it);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Add form */}
      <form
        action={addItem}
        className="bg-gray-900 border border-gray-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
      >
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Nom *</label>
          <input
            name="name"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Description</label>
          <input
            name="description"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Prix (TND) *</label>
          <input
            name="price"
            type="number"
            step="0.001"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Rayon</label>
          <input
            name="category"
            placeholder="Bouquets"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Unité</label>
          <input
            name="unit"
            placeholder="10 kg"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="md:col-span-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
        >
          <Plus size={15} />
          {busy ? "…" : "Ajouter"}
        </button>
      </form>

      {/* Item list */}
      {initialItems.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">
          Aucun article. Ajoutez-en un ci-dessus.
        </div>
      ) : (
        Object.entries(grouped).map(([section, items]) => (
          <div key={section} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <h3 className="font-semibold text-white text-sm">{section}</h3>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <tbody>
                {items.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40"
                  >
                    <td className="px-5 py-3">
                      <p className={`font-medium ${it.is_available ? "text-white" : "text-gray-500 line-through"}`}>
                        {it.name}
                      </p>
                      {it.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{it.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-300 whitespace-nowrap">
                      {Number(it.price).toFixed(3)} TND
                      {it.unit && <span className="text-gray-500"> / {it.unit}</span>}
                    </td>
                    <td className="px-5 py-3 w-px">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleAvailable(it)}
                          title={it.is_available ? "Masquer" : "Afficher"}
                          className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
                        >
                          {it.is_available ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          onClick={() => removeItem(it)}
                          className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        ))
      )}
    </div>
  );
}
