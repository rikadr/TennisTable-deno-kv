import React from "react";
import { fmtNum } from "../../common/number-utils";

export const AXIS_COLOR = "rgb(var(--color-primary-text))";
export const SERIES_COLOR = "rgb(var(--color-secondary-background))";
export const ACCENT_COLOR = "rgb(var(--color-tertiary-background))";

/**
 * Every percentage the Statistics page prints goes through here. `fmtNum` gives
 * a whole number for a value of 1 or more, and keeps 1 or 2 decimals below
 * that, so a quiet group reads as 0,4% instead of rounding away to 0%.
 */
export const percentLabel = (value: number) => `${fmtNum(value)}%`;

export const percentTick = (value: number) => percentLabel(value);

export const TooltipCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-secondary-background text-secondary-text p-3 rounded-lg shadow-lg border border-secondary-text text-sm">
    <p className="font-semibold">{title}</p>
    {children}
  </div>
);
