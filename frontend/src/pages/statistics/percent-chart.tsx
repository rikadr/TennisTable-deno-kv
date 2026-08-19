import React from "react";
import { fmtNum } from "../../common/number-utils";

export const AXIS_COLOR = "rgb(var(--color-primary-text))";
export const SERIES_COLOR = "rgb(var(--color-secondary-background))";
export const ACCENT_COLOR = "rgb(var(--color-tertiary-background))";

/**
 * Colours for a chart with many groups.
 *
 * Only two colours are safe on the page in every theme: the secondary
 * background, because a tile of it stands on the page in every theme, and the
 * primary text, because the page is read in it. The tertiary background is not
 * safe: the Optio theme sets it to a pale blue on a white page, where it
 * disappears.
 *
 * The two safe colours are the same colour in the Easter and the Skimore
 * themes, so alternating them is not enough on its own. The list also steps the
 * opacity down, which keeps two neighbours apart even where the hues collapse.
 */
export const SERIES_COLORS = [
  "rgb(var(--color-secondary-background))",
  "rgba(var(--color-primary-text),0.85)",
  "rgba(var(--color-secondary-background),0.7)",
  "rgba(var(--color-primary-text),0.55)",
  "rgba(var(--color-secondary-background),0.42)",
  "rgba(var(--color-primary-text),0.3)",
  "rgba(var(--color-secondary-background),0.2)",
  "rgba(var(--color-primary-text),0.12)",
];

export const seriesColor = (index: number): string => SERIES_COLORS[index % SERIES_COLORS.length];

/**
 * Colours for a bar of a few parts, such as the ranked mix of a game. They are
 * far apart in the list above, so the parts stay apart in every theme.
 */
export const SPREAD_COLORS = [seriesColor(0), seriesColor(3), seriesColor(6)];

/**
 * The mark that must be seen: the bar the others are read against, a reference
 * line, the dot under the pointer. The rest of the marks are painted in
 * `MUTED_SERIES_COLOR`, so the mark stands out even in a theme where the text
 * and the secondary background are the same colour.
 */
export const HIGHLIGHT_COLOR = "rgb(var(--color-primary-text))";
export const MUTED_SERIES_COLOR = "rgba(var(--color-secondary-background),0.45)";

/**
 * The four levels of detail, from the most to the least. The opacity falls with
 * the detail, so the bands hold apart in every theme, and the tracked games
 * read as the solid band.
 */
export const LEVEL_COLORS = {
  tracked: "rgb(var(--color-primary-text))",
  points: "rgba(var(--color-secondary-background),0.75)",
  sets: "rgba(var(--color-secondary-background),0.45)",
  noScore: "rgba(var(--color-secondary-background),0.2)",
};

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
