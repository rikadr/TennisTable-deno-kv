export type Period = "day" | "week" | "month" | "year";

export const PERIOD_LABELS: Record<Period, { singular: string; plural: string }> = {
  day: { singular: "Day", plural: "Days" },
  week: { singular: "Week", plural: "Weeks" },
  month: { singular: "Month", plural: "Months" },
  year: { singular: "Year", plural: "Years" },
};

const getWeekStart = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as start of week
  d.setDate(d.getDate() + diff);
  return d;
};

const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

export const getPeriodKey = (date: Date, period: Period): string => {
  switch (period) {
    case "day":
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    case "week": {
      const ws = getWeekStart(date);
      return `W-${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, "0")}-${String(ws.getDate()).padStart(2, "0")}`;
    }
    case "month":
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    case "year":
      return String(date.getFullYear());
  }
};

export const getPeriodTimestamp = (date: Date, period: Period): number => {
  switch (period) {
    case "day":
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    case "week":
      return getWeekStart(date).getTime();
    case "month":
      return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    case "year":
      return new Date(date.getFullYear(), 0, 1).getTime();
  }
};

export const getPeriodStart = (date: Date, period: Period): Date => new Date(getPeriodTimestamp(date, period));

export const advancePeriod = (date: Date, period: Period): Date => {
  const d = new Date(date);
  switch (period) {
    case "day":
      d.setDate(d.getDate() + 1);
      break;
    case "week":
      d.setDate(d.getDate() + 7);
      break;
    case "month":
      d.setMonth(d.getMonth() + 1);
      break;
    case "year":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
};

export const formatPeriod = (timestamp: number, period: Period, variant: "long" | "short" = "long"): string => {
  const date = new Date(timestamp);
  switch (period) {
    case "day":
      return date.toLocaleDateString("nb-NO", {
        weekday: variant === "short" ? "short" : "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    case "week": {
      const weekEnd = new Date(date);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekNumber = getISOWeek(date);
      const startStr = date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
      const endStr = weekEnd.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
      return `Week ${weekNumber}, ${date.getFullYear()} (${startStr} – ${endStr})`;
    }
    case "month":
      return date.toLocaleDateString("nb-NO", {
        month: "long",
        year: "numeric",
      });
    case "year":
      return String(date.getFullYear());
  }
};

export const pairingKey = (playerA: string, playerB: string): string => [playerA, playerB].sort().join("|");
