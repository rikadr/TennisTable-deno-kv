import React from "react";

/** One labelled number. The value is always a share, a median or an average. */
export const StatTile: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="flex flex-col gap-0.5 rounded-lg bg-secondary-background text-secondary-text px-3 py-2">
    <span className="text-xs md:text-sm opacity-80">{label}</span>
    <span className="text-xl md:text-2xl font-semibold leading-tight">{value}</span>
    {note && <span className="text-xs opacity-70">{note}</span>}
  </div>
);

export const StatTileRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{children}</div>
);

/** Shown instead of a chart when a period holds too few games to stay anonymous. */
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
      <span className="font-semibold tabular-nums">{share}%</span>
    </div>
    <div className="h-3 w-full rounded-full bg-secondary-background overflow-hidden">
      <div className="h-full rounded-full bg-secondary-text" style={{ width: `${share}%` }} />
    </div>
    {description && <span className="text-xs text-primary-text/60">{description}</span>}
  </div>
);
