"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import ClientRow, { ClientData } from "./ClientRow";

export default function ClientsTable({ clients }: { clients: ClientData[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? clients.filter(
        (c) =>
          (c.full_name?.toLowerCase().includes(q)) ||
          (c.phone?.toLowerCase().includes(q)) ||
          (c.email?.toLowerCase().includes(q))
      )
    : clients;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
        <h3 className="font-semibold text-white flex-1">Liste des clients</h3>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Rechercher nom, tél, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 pr-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 w-56"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Commandes</th>
              <th className="px-5 py-3 font-medium">Total dépensé</th>
              <th className="px-5 py-3 font-medium">Statut</th>
              <th className="px-5 py-3 font-medium">Inscription</th>
              <th className="px-5 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <ClientRow key={c.id} client={c} />
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                  {q ? "Aucun résultat pour cette recherche" : "Aucun client trouvé"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
