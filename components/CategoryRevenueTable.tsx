export interface CategoryRow {
  key: string;
  label: string;
  orders: number;
  revenue: number;
  gross: number;
}

/**
 * Revenue split across every vertical the platform sells, not just
 * restaurants. Rows with no orders are still rendered: "Fleurs — 0" is
 * information (that vertical exists and has not sold yet), whereas omitting
 * the row reads as though the category does not exist at all.
 */
export default function CategoryRevenueTable({ rows }: { rows: CategoryRow[] }) {
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
  const totalGross = rows.reduce((s, r) => s + r.gross, 0);
  const fmt = (n: number) => `${n.toFixed(3)} TND`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ color: "var(--text)" }}>
        <thead>
          <tr style={{ color: "var(--text-muted)" }} className="text-left">
            <th className="pb-2 font-medium">Catégorie</th>
            <th className="pb-2 text-right font-medium">Commandes</th>
            <th className="pb-2 text-right font-medium">Chiffre d&apos;affaires</th>
            <th className="pb-2 text-right font-medium">Revenu plateforme</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ borderTop: "1px solid var(--border)" }}>
              <td className="py-2">{r.label}</td>
              <td
                className="py-2 text-right tabular-nums"
                style={{ color: r.orders === 0 ? "var(--text-faint)" : undefined }}
              >
                {r.orders}
              </td>
              <td
                className="py-2 text-right tabular-nums"
                style={{ color: r.gross === 0 ? "var(--text-faint)" : undefined }}
              >
                {fmt(r.gross)}
              </td>
              <td
                className="py-2 text-right tabular-nums font-semibold"
                style={{ color: r.revenue === 0 ? "var(--text-faint)" : "var(--brand-text)" }}
              >
                {fmt(r.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid var(--border-strong)" }}>
            <td className="pt-2 font-semibold">Total</td>
            <td className="pt-2 text-right font-semibold tabular-nums">{totalOrders}</td>
            <td className="pt-2 text-right font-semibold tabular-nums">{fmt(totalGross)}</td>
            <td className="pt-2 text-right font-semibold tabular-nums">{fmt(totalRevenue)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
