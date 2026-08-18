export type TimeRange = "day" | "week" | "month" | "year" | "all";

export const TIME_RANGES: TimeRange[] = ["day", "week", "month", "year", "all"];

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  day: "Today",
  week: "7 days",
  month: "30 days",
  year: "365 days",
  all: "All time",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** "day" is the current calendar day; the other ranges are rolling windows ending now. */
export const getRangeCutoff = (range: TimeRange, now: Date): number => {
  switch (range) {
    case "day":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    case "week":
      return now.getTime() - 7 * DAY_MS;
    case "month":
      return now.getTime() - 30 * DAY_MS;
    case "year":
      return now.getTime() - 365 * DAY_MS;
    case "all":
      return 0;
  }
};
