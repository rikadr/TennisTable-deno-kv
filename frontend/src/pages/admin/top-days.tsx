import React, { useMemo } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";

export const TopGamingDays: React.FC = () => {
  const context = useEventDbContext();

  const topDays = useMemo(() => {
    if (context.games.length === 0) {
      return [];
    }

    const dailyGameCounts = new Map<string, { count: number; timestamp: number }>();

    // Group games by day
    context.games.forEach(({ playedAt }) => {
      const date = new Date(playedAt);
      // Create a key for the day (YYYY-MM-DD format)
      const dayKey = date.toISOString().split("T")[0];
      const dayTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

      if (dailyGameCounts.has(dayKey)) {
        dailyGameCounts.get(dayKey)!.count++;
      } else {
        dailyGameCounts.set(dayKey, { count: 1, timestamp: dayTimestamp });
      }
    });

    // Convert to array, sort by count descending, and take top 10
    return Array.from(dailyGameCounts.entries())
      .map(([dayKey, data]) => ({
        date: dayKey,
        count: data.count,
        timestamp: data.timestamp,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [context.games]);

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("nb-NO", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (topDays.length === 0) {
    return (
      <div className="bg-primary-background text-primary-text rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-6">Top Gaming Days</h2>
        <div className="text-center text-primary-text p-8 bg-secondary-background rounded-lg">
          <p className="text-lg">No games data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary-background text-primary-text rounded-lg p-6 max-w-3xl">
      <h2 className="text-2xl font-semibold mb-6">Top Gaming Days</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topDays.map((day, index) => (
          <div
            key={day.date}
            className="flex items-center justify-between py-3 px-4 bg-secondary-background rounded-lg hover:bg-secondary-background/80 transition-colors shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-background text-primary-text font-bold text-lg flex-shrink-0">
                {index + 1}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-secondary-text capitalize truncate">{formatDate(day.date)}</p>
                <p className="text-sm text-secondary-text/75">{relativeTimeString(new Date(day.timestamp))}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <p className="text-2xl font-bold text-secondary-text">{day.count}</p>
              <p className="text-xs text-secondary-text/75">{day.count === 1 ? "game" : "games"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
