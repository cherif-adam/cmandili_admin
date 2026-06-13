import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: "orange" | "blue" | "green" | "red" | "purple";
}

const colorMap = {
  orange: "text-orange-400 bg-orange-500/10",
  blue: "text-blue-400 bg-blue-500/10",
  green: "text-green-400 bg-green-500/10",
  red: "text-red-400 bg-red-500/10",
  purple: "text-purple-400 bg-purple-500/10",
};

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "orange",
}: StatsCardProps) {
  const colorClass = colorMap[color];
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${colorClass}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
