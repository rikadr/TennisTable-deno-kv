import React from "react";
import { percentLabel } from "./percent-chart";

/** One labelled number. The value is always a share, a median or an average. */
export const StatTile: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="flex flex-col gap-0.5 rounded-lg bg-secondary-background text-secondary-text px-3 py-2">
    <span className="text-xs md:text-sm opacity-80">{label}</span>
    <span className="text-xl md:text-2xl font-semibold leading-tight">{value}</span>
    {note && <span className="text-xs opacity-70">{note}</span>}
  </div>
);

/** The wide layout of a row, so a row of 3 tiles fills its width too. */
const ROW_COLUMNS = { 3: "md:grid-cols-3", 4: "md:grid-cols-4" } as const;

export const StatTileRow: React.FC<{ columns?: 3 | 4; children: React.ReactNode }> = ({ columns = 4, children }) => (
  <div className={`grid grid-cols-2 ${ROW_COLUMNS[columns]} gap-2`}>{children}</div>
);

/** Shown instead of a chart when a period holds no game with the statistic. */
export const NotEnoughGames: React.FC<{ what?: string }> = ({ what = "games" }) => (
  <p className="text-sm text-primary-text/60">Not enough {what} in this period yet.</p>
);

/** A horizontal share bar. The label carries the percent, the bar the shape. */
export const ShareBar: React.FC<{ label: string; share: number; description?: string }> = ({
  label,
  share,
  description,
}) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-baseline justify-between gap-2 text-sm text-primary-text">
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{percentLabel(share)}</span>
    </div>
    <div className="h-3 w-full rounded-full bg-secondary-background overflow-hidden">
      <div className="h-full rounded-full bg-secondary-text" style={{ width: `${share}%` }} />
    </div>
    {description && <span className="text-xs text-primary-text/60">{description}</span>}
  </div>
);

/**
 * One bar split into shares that add up to 100. Use it where the groups are
 * parts of one whole, such as the three ranked mixes of a game, or the two
 * sides of a single question.
 */
export const StackedShareBar: React.FC<{ segments: { label: string; share: number; color: string }[] }> = ({
  segments,
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex h-6 w-full rounded-full overflow-hidden bg-secondary-background/30">
      {segments.map((segment) => (
        <div key={segment.label} style={{ width: `${segment.share}%`, backgroundColor: segment.color }} />
      ))}
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-primary-text/80">
      {segments.map((segment) => (
        <span key={segment.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: segment.color }} />
          {segment.label}
          <span className="tabular-nums font-semibold">{percentLabel(segment.share)}</span>
        </span>
      ))}
    </div>
  </div>
);
