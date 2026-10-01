import React from "react";
import { Link } from "react-router-dom";
import { classNames } from "../../common/class-names";

type Props = {
  title: string;
  /** Short context next to the title, e.g. "Season" when the card shows season data */
  badge?: string;
  subtitle?: React.ReactNode;
  /** Opens the full page for the card's content */
  to?: string;
  /** Replaces the "See all" link on the right of the header */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** The frame of every dashboard widget: a bordered card with a left-aligned header */
export const DashboardCard: React.FC<Props> = ({ title, badge, subtitle, to, action, className, children }) => (
  <section
    className={classNames(
      "mb-0 w-full bg-primary-background text-primary-text rounded-xl ring-1 ring-primary-text/15 overflow-hidden",
      className,
    )}
  >
    <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-xl xs:text-2xl font-bold truncate">{title}</h2>
          {badge && (
            <span className="shrink-0 rounded-full bg-secondary-background text-secondary-text px-2 py-0.5 text-xs font-medium">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <div className="text-xs xs:text-sm font-light text-primary-text/80">{subtitle}</div>}
      </div>
      {action ??
        (to && (
          <Link to={to} className="shrink-0 text-sm text-primary-text/70 hover:text-primary-text hover:underline">
            See all →
          </Link>
        ))}
    </header>
    {children}
  </section>
);
