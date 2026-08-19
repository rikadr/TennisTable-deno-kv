import React from "react";
import { fmtNum } from "../../common/number-utils";

export const AXIS_COLOR = "rgb(var(--color-primary-text))";
export const SERIES_COLOR = "rgb(var(--color-secondary-background))";
export const ACCENT_COLOR = "rgb(var(--color-tertiary-background))";

/**
 * Colours for a chart with many groups. Every one is a theme colour, so a chart
 * follows the theme the way the rest of the page does. The two base colours
 * alternate and then fade, so neighbours in a pie or a stack stay apart.
 */
export const SERIES_COLORS = [
  "rgb(var(--color-secondary-background))",
  "rgb(var(--color-tertiary-background))",
  "rgba(var(--color-secondary-background),0.65)",
  "rgba(var(--color-tertiary-background),0.65)",
  "rgba(var(--color-secondary-background),0.4)",
  "rgba(var(--color-tertiary-background),0.4)",
  "rgba(var(--color-secondary-background),0.25)",
  "rgba(var(--color-tertiary-background),0.25)",
];

export const seriesColor = (index: number): string => SERIES_COLORS[index % SERIES_COLORS.length];

/**
 * The four levels of detail, from the most to the least. The colour gets
 * stronger with the detail, so the tracked games read as the solid band.
 */
export const LEVEL_COLORS = {
  tracked: "rgb(var(--color-tertiary-background))",
  points: "rgb(var(--color-secondary-background))",
  sets: "rgba(var(--color-secondary-background),0.6)",
  noScore: "rgba(var(--color-secondary-background),0.3)",
};

/**
 * Every percentage the Statistics page prints goes through here. `fmtNum` gives
 * a whole number for a value of 1 or more, and keeps 1 or 2 decimals below
 * that, so a quiet group reads as 0,4% instead of rounding away to 0%.
 */
export const percentLabel = (value: number) => `${fmtNum(value)}%`;

export const percentTick = (value: number) => percentLabel(value);

/**
 * A ratio, printed the way the page says it out loud: "1,4x". A ratio keeps its
 * decimal even when it lands on a whole number, so 1,0x reads as measured and
 * not as rounded.
 */
export const ratioLabel = (value: number | undefined) =>
  value === undefined
    ? "–"
    : `${value.toLocaleString("no-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x`;

export const TooltipCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-secondary-background text-secondary-text p-3 rounded-lg shadow-lg border border-secondary-text text-sm">
    <p className="font-semibold">{title}</p>
    {children}
  </div>
);
