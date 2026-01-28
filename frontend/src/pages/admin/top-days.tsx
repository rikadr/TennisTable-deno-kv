import React, { useMemo } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";

interface DayData {
  date: string;
  count: number;
  timestamp: number;
}

export const TopGamingDays: React.FC = () => {
  const context = useEventDbContext();

  const sixMonthsAgo = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.getTime();
  }, []);

  const { topDaysAllTime, topDaysLast6Months } = useMemo(() => {
    if (context.games.length === 0) {
      return { topDaysAllTime: [], topDaysLast6Months: [] };
    }

    const allTimeCounts = new Map<string, { count: number; timestamp: number }>();
    const last6MonthsCounts = new Map<string, { count: number; timestamp: number }>();

    // Group games by day
    context.games.forEach(({ playedAt }) => {
      const date = new Date(playedAt);
      const dayKey = date.toISOString().split("T")[0];
      const dayTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

      // All time
      if (allTimeCounts.has(dayKey)) {
        allTimeCounts.get(dayKey)!.count++;
      } else {
        allTimeCounts.set(dayKey, { count: 1, timestamp: dayTimestamp });
      }

      // Last 6 months
      if (playedAt >= sixMonthsAgo) {
        if (last6MonthsCounts.has(dayKey)) {
          last6MonthsCounts.get(dayKey)!.count++;
        } else {
          last6MonthsCounts.set(dayKey, { count: 1, timestamp: dayTimestamp });
        }
      }
    });

    const sortAndSlice = (map: Map<string, { count: number; timestamp: number }>): DayData[] =>
      Array.from(map.entries())
        .map(([dayKey, data]) => ({
          date: dayKey,
          count: data.count,
          timestamp: data.timestamp,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return {
      topDaysAllTime: sortAndSlice(allTimeCounts),
      topDaysLast6Months: sortAndSlice(last6MonthsCounts),
    };
  }, [context.games, sixMonthsAgo]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("nb-NO", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (topDaysAllTime.length === 0) {
    return (
      <div className="bg-primary-background text-primary-text rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Top Gaming Days</h2>
        <div className="text-center text-primary-text p-4 bg-secondary-background rounded-lg">
          <p>No games data available</p>
        </div>
      </div>
    );
  }

  const TopDaysTable = ({ title, data }: { title: string; data: DayData[] }) => (
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-secondary-background text-secondary-text">
            <th className="px-2 py-1 text-left border border-primary-text/20">#</th>
            <th className="px-2 py-1 text-left border border-primary-text/20">Date</th>
            <th className="px-2 py-1 text-left border border-primary-text/20">When</th>
            <th className="px-2 py-1 text-right border border-primary-text/20">Games</th>
          </tr>
        </thead>
        <tbody>
          {data.map((day, index) => (
            <tr key={day.date} className="hover:bg-secondary-background/50">
              <td className="px-2 py-1 border border-primary-text/20 font-medium">{index + 1}</td>
              <td className="px-2 py-1 border border-primary-text/20 whitespace-nowrap">{formatDate(day.date)}</td>
              <td className="px-2 py-1 border border-primary-text/20 whitespace-nowrap">{relativeTimeString(new Date(day.timestamp))}</td>
              <td className="px-2 py-1 border border-primary-text/20 text-right font-bold">{day.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="bg-primary-background text-primary-text rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">Top Gaming Days</h2>
      <div className="flex flex-col md:flex-row gap-4">
        <TopDaysTable title="All Time" data={topDaysAllTime} />
        <TopDaysTable title="Last 6 Months" data={topDaysLast6Months} />
      </div>
    </div>
  );
};
