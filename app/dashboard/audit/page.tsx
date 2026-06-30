export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  block_driver:               "Livreur bloqué",
  unblock_driver:             "Livreur débloqué",
  block_restaurant:           "Restaurant bloqué",
  unblock_restaurant:         "Restaurant débloqué",
  block_customer:             "Client bloqué",
  unblock_customer:           "Client débloqué",
  create_promo:               "Code promo créé",
  update_promo:               "Code promo modifié",
  delete_promo:               "Code promo supprimé",
  update_commission_rates:    "Taux de commission modifiés",
  enable_ghost_restaurant:    "Ghost restaurant activé",
  disable_ghost_restaurant:   "Ghost restaurant désactivé",
  enable_ghost_supermarket:   "Ghost supermarché activé",
  disable_ghost_supermarket:  "Ghost supermarché désactivé",
  add_menu_item:              "Article ajouté au menu",
  update_menu_item:           "Article modifié (menu)",
  delete_menu_item:           "Article supprimé (menu)",
};

const ACTION_GROUPS: Record<string, string[]> = {
  "Livreurs":       ["block_driver", "unblock_driver"],
  "Restaurants":    ["block_restaurant", "unblock_restaurant", "enable_ghost_restaurant", "disable_ghost_restaurant"],
  "Supermarchés":   ["enable_ghost_supermarket", "disable_ghost_supermarket"],
  "Clients":        ["block_customer", "unblock_customer"],
  "Promotions":     ["create_promo", "update_promo", "delete_promo"],
  "Paramètres":     ["update_commission_rates"],
  "Menus":          ["add_menu_item", "update_menu_item", "delete_menu_item"],
};

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return "—";
  const entries = Object.entries(details)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "number" ? v : String(v)}`)
    .slice(0, 3);
  return entries.join(" · ") || "—";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string; action?: string; from?: string; to?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Distinct admin emails for the filter dropdown
  const { data: adminRows } = await supabaseAdmin
    .from("audit_logs")
    .select("admin_email")
    .order("admin_email");
  const uniqueAdmins = [...new Set((adminRows ?? []).map((r) => r.admin_email))];

  // Main query
  let query = supabaseAdmin
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.admin)  query = query.eq("admin_email", params.admin);
  if (params.action) query = query.eq("action_type", params.action);
  if (params.from)   query = query.gte("created_at", params.from);
  if (params.to)     query = query.lte("created_at", params.to + "T23:59:59Z");

  const { data: logs, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  function pageUrl(p: number) {
    const sp = new URLSearchParams();
    if (params.admin)  sp.set("admin", params.admin);
    if (params.action) sp.set("action", params.action);
    if (params.from)   sp.set("from", params.from);
    if (params.to)     sp.set("to", params.to);
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Journal d&apos;activité</h2>
          <p className="text-sm text-gray-400 mt-1">
            {count ?? 0} action{(count ?? 0) !== 1 ? "s" : ""} enregistrée{(count ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium">Administrateur</label>
          <select
            name="admin"
            defaultValue={params.admin ?? ""}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 min-w-[180px]"
          >
            <option value="">Tous les admins</option>
            {uniqueAdmins.map((email) => (
              <option key={email} value={email}>{email}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium">Type d&apos;action</label>
          <select
            name="action"
            defaultValue={params.action ?? ""}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 min-w-[200px]"
          >
            <option value="">Toutes les actions</option>
            {Object.entries(ACTION_GROUPS).map(([group, types]) => (
              <optgroup key={group} label={group}>
                {types.map((t) => (
                  <option key={t} value={t}>{ACTION_LABELS[t] ?? t}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium">Du</label>
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium">Au</label>
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-sm font-medium hover:bg-orange-500/30 transition-colors"
        >
          Filtrer
        </button>
        <a
          href="/dashboard/audit"
          className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm font-medium hover:text-gray-200 transition-colors"
        >
          Réinitialiser
        </a>
      </form>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Administrateur</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Cible</th>
                <th className="px-5 py-3 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).map((log) => (
                <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                  <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString("fr-TN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-5 py-3 text-gray-300 text-xs">{log.admin_email}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300">
                      {ACTION_LABELS[log.action_type] ?? log.action_type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {log.target_type && (
                      <span className="text-gray-500 mr-1">{log.target_type}</span>
                    )}
                    {log.target_id && (
                      <span className="font-mono">{String(log.target_id).slice(0, 8).toUpperCase()}</span>
                    )}
                    {!log.target_type && !log.target_id && "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs max-w-xs truncate">
                    {formatDetails(log.details)}
                  </td>
                </tr>
              ))}
              {!(logs ?? []).length && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-500">
                    Aucune action enregistrée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between text-sm text-gray-400">
            <span>
              Page {page} / {totalPages} — {count} entrées
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={pageUrl(page - 1)}
                  className="px-3 py-1.5 bg-gray-800 rounded-lg hover:text-gray-200 transition-colors"
                >
                  ← Précédent
                </a>
              )}
              {page < totalPages && (
                <a
                  href={pageUrl(page + 1)}
                  className="px-3 py-1.5 bg-gray-800 rounded-lg hover:text-gray-200 transition-colors"
                >
                  Suivant →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
