import { LucideIcon } from "lucide-react";

/** Compact, consistent page heading. */
export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
}: {
  title: string;
  /** Text, or a fragment when the caller interpolates counts. */
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={17} style={{ color: "var(--text-muted)" }} />}
        <div>
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
