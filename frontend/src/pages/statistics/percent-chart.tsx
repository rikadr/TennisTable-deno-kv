import React from "react";

export const AXIS_COLOR = "rgb(var(--color-primary-text))";
export const SERIES_COLOR = "rgb(var(--color-secondary-background))";
export const ACCENT_COLOR = "rgb(var(--color-tertiary-background))";

export const percentTick = (value: number) => `${value}%`;

export const TooltipCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-secondary-background text-secondary-text p-3 rounded-lg shadow-lg border border-secondary-text text-sm">
    <p className="font-semibold">{title}</p>
    {children}
  </div>
);
