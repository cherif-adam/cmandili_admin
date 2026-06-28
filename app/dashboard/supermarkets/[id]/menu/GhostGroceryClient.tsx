"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, Ghost } from "lucide-react";

interface GroceryItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  unit: string | null;
  is_organic: boolean;
  is_available: boolean;
  image_url: string | null;
}

interface FormState {
  id?: string;
  name: string;
  description: string;
  price: string;
  category: string;
  unit: string;
  is_organic: boolean;
  is_available: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  price: "",
  category: "",
  unit: "pièce",
  is_organic: false,
  is_available: true,
};

export default function GhostGroceryClient({
  supermarketId,
  supermarketName,
  isGhost,
  initialItems,
}: {
  supermarketId: string;
  supermarketName: string;
  isGhost: boolean;
  initialItems: GroceryItem[];
}) {
  const [items, setItems] = useState<GroceryItem[]>(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(item: GroceryItem) {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      category: item.category ?? "",
      unit: item.unit ?? "pièce",
      is_organic: item.is_organic,
      is_available: item.is_available,
    });
    setError(null);
    setShowForm(true);
  }

  async function saveItem() {
    if (!form.name.trim() || !form.price) {
      setError("Nom et prix sont requis.");
      return;
    }
    setSaving(true);
    setError(null);

    const isEdit = !!form.id;
    const res = await fetch("/api/supermarkets/menu", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isEdit ? { id: form.id } : { supermarket_id: supermarketId }),
        name: form.name.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price),
        category: form.category.trim(),
        unit: form.unit.trim() || "pièce",
        is_organic: form.is_organic,
        is_available: form.is_available,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erreur serveur");
      setSaving(false);
      return;
    }

    const next: GroceryItem = {
      id: isEdit ? form.id! : json.id,
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      category: form.category.trim(),
      unit: form.unit.trim() || "pièce",
      is_organic: form.is_organic,
      is_available: form.is_available,
      image_url: null,
    };

    if (isEdit) {
      setItems((prev) => prev.map((it) => (it.id === form.id ? { ...it, ...next } : it)));
    } else {
      setItems((prev) => [...prev, next]);
    }

    setShowForm(false);
    setSaving(false);
  }

  async function deleteItem(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    const res = await fetch(`/api/supermarkets/menu?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
  }

  const byCategory: Record<string, GroceryItem[]> = {};
  for (const item of items) {
    const cat = item.category || "Sans catégorie";
    (byCategory[cat] ??= []).push(item);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/supermarkets"
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white">{supermarketName}</h2>
              {isGhost && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-medium">
                  <Ghost size={11} />
                  Fantôme
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {items.length} produit{items.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Ajouter un produit
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-white">
            {form.id ? "Modifier le produit" : "Nouveau produit"}
          </h3>
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nom *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ex: Tomates"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Catégorie</label>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ex: vegetables, fruits, dairy"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Prix (TND) *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="0.000"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Unité</label>
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="kg, pièce, litre..."
              />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <label className="text-xs text-gray-400">Disponible</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_available: !form.is_available })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  form.is_available ? "bg-green-500" : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    form.is_available ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <label className="text-xs text-gray-400">Bio / Organique</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_organic: !form.is_organic })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  form.is_organic ? "bg-green-500" : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    form.is_organic ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Description optionnelle"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={saveItem}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Enregistrement..." : form.id ? "Mettre à jour" : "Ajouter"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Items grouped by category */}
      {Object.keys(byCategory).length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-12 text-center text-gray-500">
          Aucun produit pour l&apos;instant. Cliquez sur &quot;Ajouter un produit&quot; pour commencer.
        </div>
      ) : (
        Object.entries(byCategory).map(([cat, catItems]) => (
          <div key={cat} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 bg-gray-800/40">
              <h3 className="font-semibold text-white text-sm">{cat}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                  <th className="px-5 py-2 font-medium">Produit</th>
                  <th className="px-5 py-2 font-medium">Prix</th>
                  <th className="px-5 py-2 font-medium">Dispo</th>
                  <th className="px-5 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {catItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3">
                      <p className="text-white font-medium">
                        {item.name}
                        {item.unit ? <span className="text-gray-500"> / {item.unit}</span> : null}
                        {item.is_organic && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">
                            Bio
                          </span>
                        )}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                          {item.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-300 whitespace-nowrap">
                      {item.price.toFixed(3)} TND
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          item.is_available
                            ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {item.is_available ? "Disponible" : "Indispo"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
