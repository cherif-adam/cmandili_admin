import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: "orange" | "blue" | "green" | "red" | "purple";
}

/**
 * Compact KPI tile. The previous version used a 2xl number and heavy padding,
 * which made four of them eat a third of the screen before any actual data.
 */
const accent = {
  orange: "#f59e0b",
  blue: "#3b82f6",
  green: "#10b981",
  red: "#ef4444",
  purple: "#8b5cf6",
};

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "orange",
}: StatsCardProps) {
  const c = accent[color];
  return (
    <div
      className="flex items-center gap-3 rounded-lg p-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${c}1a`, color: c }}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
          {title}
        </p>
        <p className="tabular text-lg font-semibold leading-tight">{value}</p>
        {subtitle && (
          <p className="truncate text-[10px]" style={{ color: "var(--text-faint)" }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
