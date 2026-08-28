import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Reusable rounded chart/section container with an icon title, optional
 * subtitle, an optional header action slot (legend/dropdown/link) and body.
 */
export function ChartCard({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`chart-card ${className}`}>
      <header className="chart-card-head">
        <div className="chart-card-titles">
          <h3 className="chart-card-title">
            {Icon && (
              <span className="chart-card-icon" aria-hidden="true">
                <Icon size={16} strokeWidth={2.2} />
              </span>
            )}
            {title}
          </h3>
          {subtitle && <p className="chart-card-sub">{subtitle}</p>}
        </div>
        {action && <div className="chart-card-action">{action}</div>}
      </header>
      {children}
    </section>
  );
}
