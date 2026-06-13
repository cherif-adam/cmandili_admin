"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: Array<{
    date: string;
    "Commissions restaurants": number;
    "Commissions livreurs": number;
  }>;
}

export default function RevenueChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
        Aucune donnée disponible
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit=" TND" width={72} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#111827",
            border: "1px solid #374151",
            borderRadius: 8,
            color: "#f9fafb",
          }}
          formatter={(v) => [`${Number(v ?? 0).toFixed(3)} TND`]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
        <Bar dataKey="Commissions restaurants" fill="#f97316" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Commissions livreurs" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
