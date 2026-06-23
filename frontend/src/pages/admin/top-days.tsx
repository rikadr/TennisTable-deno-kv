import React, { useMemo, useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";

type Period = "day" | "week" | "month" | "year";

interface PeriodData {
  key: string;
  count: number;
  timestamp: number;
}

interface CurrentEntry {
  rank: number;
  total: number;
  entry: PeriodData;
}

interface TopPeriodsResult {
  top: PeriodData[];
  current: CurrentEntry | null;
}

const PERIOD_LABELS: Record<Period, { singular: string; plural: string }> = {
  day: { singular: "Day", plural: "Days" },
  week: { singular: "Week", plural: "Weeks" },
  month: { singular: "Month", plural: "Months" },
  year: { singular: "Year", plural: "Years" },
};

const RECENT_WINDOW_MS: Record<Period, number> = {
  day: 6 * 30 * 24 * 60 * 60 * 1000, // 6 months
  week: 365 * 24 * 60 * 60 * 1000, // 1 year
  month: 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
  year: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years
};

const RECENT_WINDOW_LABELS: Record<Period, string> = {
  day: "Last 6 Months",
  week: "Last Year",
  month: "Last 2 Years",
  year: "Last 10 Years",
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

const getPeriodKey = (date: Date, period: Period): string => {
  switch (period) {
    case "day":
      return date.toISOString().split("T")[0];
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

const getPeriodTimestamp = (date: Date, period: Period): number => {
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

const formatPeriod = (timestamp: number, period: Period): string => {
  const date = new Date(timestamp);
  switch (period) {
    case "day":
      return date.toLocaleDateString("nb-NO", {
        weekday: "long",
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

export const TopGamingDays: React.FC = () => {
  const context = useEventDbContext();
  const [period, setPeriod] = useState<Period>("day");

  const recentCutoff = useMemo(() => Date.now() - RECENT_WINDOW_MS[period], [period]);

  const currentKey = useMemo(() => getPeriodKey(new Date(), period), [period]);

  const { topAllTime, topRecent } = useMemo(() => {
    const empty: TopPeriodsResult = { top: [], current: null };
    if (context.games.length === 0) {
      return { topAllTime: empty, topRecent: empty };
    }

    const allTimeCounts = new Map<string, { count: number; timestamp: number }>();
    const recentCounts = new Map<string, { count: number; timestamp: number }>();

    context.games.forEach(({ playedAt }) => {
      const date = new Date(playedAt);
      const key = getPeriodKey(date, period);
      const timestamp = getPeriodTimestamp(date, period);

      const existingAll = allTimeCounts.get(key);
      if (existingAll) {
        existingAll.count++;
      } else {
        allTimeCounts.set(key, { count: 1, timestamp });
      }

      if (playedAt >= recentCutoff) {
        const existingRecent = recentCounts.get(key);
        if (existingRecent) {
          existingRecent.count++;
        } else {
          recentCounts.set(key, { count: 1, timestamp });
        }
      }
    });

    const buildResult = (map: Map<string, { count: number; timestamp: number }>): TopPeriodsResult => {
      const sorted = Array.from(map.entries())
        .map(([key, data]) => ({
          key,
          count: data.count,
          timestamp: data.timestamp,
        }))
        .sort((a, b) => b.count - a.count);

      const currentIndex = sorted.findIndex((entry) => entry.key === currentKey);
      const current: CurrentEntry | null =
        currentIndex >= 0
          ? { rank: currentIndex + 1, total: sorted.length, entry: sorted[currentIndex] }
          : null;

      return { top: sorted.slice(0, 10), current };
    };

    return {
      topAllTime: buildResult(allTimeCounts),
      topRecent: buildResult(recentCounts),
    };
  }, [context.games, period, recentCutoff, currentKey]);

  const periodLabel = PERIOD_LABELS[period];

  if (context.games.length === 0) {
    return (
      <div className="bg-primary-background text-primary-text rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Top Gaming {periodLabel.plural}</h2>
        <div className="text-center text-primary-text p-4 bg-secondary-background rounded-lg">
          <p>No games data available</p>
        </div>
      </div>
    );
  }

  const TopPeriodsTable = ({ title, data }: { title: string; data: TopPeriodsResult }) => {
    const now = Date.now();
    const windowMs = RECENT_WINDOW_MS[period];
    const { top, current } = data;

    const renderRow = (entry: PeriodData, rank: number, total: number | null) => {
      const ageMs = now - entry.timestamp;
      const recencyPercent = Math.max(0, Math.min(100, (1 - ageMs / windowMs) * 100));
      const isCurrent = entry.key === currentKey;

      return (
        <tr
          key={entry.key}
          className={
            isCurrent ? "bg-tertiary-background text-tertiary-text" : "hover:bg-secondary-background/50"
          }
        >
          <td className="px-2 py-1 border border-primary-text/20 font-medium whitespace-nowrap">
            {total !== null ? `${rank} / ${total}` : rank}
          </td>
          <td className="px-2 py-1 border border-primary-text/20 whitespace-nowrap">
            {formatPeriod(entry.timestamp, period)}
          </td>
          <td className="px-2 py-1 border border-primary-text/20 whitespace-nowrap relative overflow-hidden">
            {relativeTimeString(new Date(entry.timestamp))}
            <div
              className={`absolute bottom-0 left-0 h-[2px] ${isCurrent ? "bg-tertiary-text" : "bg-current"}`}
              style={{ width: `${recencyPercent}%` }}
            />
          </td>
          <td className="px-2 py-1 border border-primary-text/20 text-right font-bold">{entry.count}</td>
        </tr>
      );
    };

    return (
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        {top.length === 0 ? (
          <div className="text-center text-primary-text p-4 bg-secondary-background rounded-lg text-xs">
            No data for this period
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-secondary-background text-secondary-text">
                <th className="px-2 py-1 text-left border border-primary-text/20">#</th>
                <th className="px-2 py-1 text-left border border-primary-text/20">{periodLabel.singular}</th>
                <th className="px-2 py-1 text-left border border-primary-text/20">When</th>
                <th className="px-2 py-1 text-right border border-primary-text/20">Games</th>
              </tr>
            </thead>
            <tbody>
              {top.map((entry, index) => renderRow(entry, index + 1, null))}
              {current && current.rank > 10 && renderRow(current.entry, current.rank, current.total)}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  return (
    <div className="bg-primary-background text-primary-text rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold">Top Gaming {periodLabel.plural}</h2>
        <div className="flex gap-1" role="tablist" aria-label="Group by period">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded border border-primary-text/20 transition-colors ${
                period === p
                  ? "bg-secondary-background text-secondary-text font-semibold"
                  : "bg-primary-background hover:bg-secondary-background/50"
              }`}
            >
              {PERIOD_LABELS[p].plural}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-4">
        <TopPeriodsTable title="All Time" data={topAllTime} />
        <TopPeriodsTable title={RECENT_WINDOW_LABELS[period]} data={topRecent} />
      </div>
      {(topAllTime.current || topRecent.current) && (
        <div className="mt-3 text-xs flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-tertiary-background border border-primary-text/20" />
          <span>Current {periodLabel.singular.toLowerCase()}</span>
        </div>
      )}
    </div>
  );
};
