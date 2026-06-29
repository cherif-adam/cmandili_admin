// PUBLIC PAGE — no authentication required.
// Only reads a single row from generated_statements by reference_code.
// No other admin data is exposed.
import { supabaseAdmin } from "@/lib/supabase-admin";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

interface OrderSnap {
  id: string;
  date: string;
  label: string;
  amount: number;
  commission: number;
}

export default async function RelevePage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;

  const { data: stmt } = await supabaseAdmin
    .from("generated_statements")
    .select("*")
    .eq("reference_code", ref)
    .single();

  if (!stmt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-5xl font-bold text-gray-200 mb-4">404</p>
          <p className="text-gray-500 font-medium">Relevé introuvable</p>
          <p className="text-gray-400 text-sm mt-1">
            Ce lien est invalide, expiré ou n&apos;existe pas.
          </p>
        </div>
      </div>
    );
  }

  const orders   = (stmt.orders_snapshot ?? []) as OrderSnap[];
  const isDriver = stmt.entity_type === "driver";

  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    });

  const generatedAt = new Date(stmt.generated_at).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
      <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-2xl overflow-hidden print:shadow-none print:rounded-none">

        {/* Header bar */}
        <div className="bg-orange-500 px-8 py-5 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">
              Cmandili
            </p>
            <h1 className="text-white text-2xl font-bold mt-0.5">Relevé officiel</h1>
          </div>
          <PrintButton />
        </div>

        {/* Entity + meta block */}
        <div className="px-8 py-6 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              {isDriver ? "Livreur" : "Restaurant"}
            </p>
            <p className="text-xl font-bold text-gray-900">{stmt.entity_name}</p>
            {stmt.entity_phone && (
              <p className="text-sm text-gray-500 mt-0.5">{stmt.entity_phone}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Période</span>
              <span className="font-medium text-gray-800">
                {fmtDate(stmt.date_from)} → {fmtDate(stmt.date_to)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Référence</span>
              <span className="font-mono font-bold text-orange-600 tracking-wide">
                {stmt.reference_code}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Généré le</span>
              <span className="text-gray-700">{generatedAt}</span>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="px-8 py-5 border-b border-gray-100 grid grid-cols-3 gap-4 text-center bg-gray-50">
          <div>
            <p className="text-3xl font-bold text-gray-900">{stmt.order_count}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">
              Commandes
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {Number(stmt.total_amount).toFixed(3)}
            </p>
            <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">
              TND {isDriver ? "Frais livrés" : "Chiffre d'affaires"}
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold text-orange-600">
              {Number(stmt.total_commission).toFixed(3)}
            </p>
            <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">
              TND Commission
            </p>
          </div>
        </div>

        {/* Orders table */}
        <div className="px-8 py-6">
          {orders.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">
              Aucune commande livrée sur cette période.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      N° Commande
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {isDriver ? "Restaurant" : "Client"}
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {isDriver ? "Frais livraison" : "Sous-total"}
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {isDriver ? "Votre commission" : "Commission plateforme"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr
                      key={o.id + i}
                      className="border-b border-gray-100 hover:bg-orange-50/40 transition-colors"
                    >
                      <td className="py-3 px-2 font-mono text-xs text-gray-600">{o.id}</td>
                      <td className="py-3 px-2 text-gray-700">{o.date}</td>
                      <td className="py-3 px-2 text-gray-700">{o.label}</td>
                      <td className="py-3 px-2 text-right text-gray-800 font-medium">
                        {Number(o.amount).toFixed(3)} TND
                      </td>
                      <td className="py-3 px-2 text-right text-orange-600 font-semibold">
                        {Number(o.commission).toFixed(3)} TND
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals footer */}
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-orange-50">
                    <td colSpan={3} className="py-3 px-2 font-bold text-gray-900 text-right">
                      TOTAL
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-gray-900">
                      {Number(stmt.total_amount).toFixed(3)} TND
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-orange-600">
                      {Number(stmt.total_commission).toFixed(3)} TND
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Legal footer */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Ce document est généré automatiquement par la plateforme{" "}
            <strong className="text-orange-500">Cmandili</strong> et fait foi entre
            les parties pour la période indiquée.
          </p>
          <p className="text-xs text-gray-300 mt-1">Réf : {stmt.reference_code}</p>
        </div>
      </div>
    </div>
  );
}
