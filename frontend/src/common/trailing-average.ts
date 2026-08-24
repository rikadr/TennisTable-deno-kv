/**
 * The trailing average of the last `window` values, one per input value. A
 * point early in the series has fewer than `window` values behind it, and its
 * average covers the values there are, so the line spans the whole chart
 * instead of starting a window late.
 */
export function trailingAverage(values: number[], window: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1);
    const sum = slice.reduce((total, value) => total + value, 0);
    return sum / slice.length;
  });
}

/** Buckets in 6 months, for a chart bucketed per week or per month. */
export const TRAILING_6_MONTHS = { week: 26, month: 6 } as const;
