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

    // Convert to array, sort by count descending, and take top 3
    return Array.from(dailyGameCounts.entries())
      .map(([dayKey, data]) => ({
        date: dayKey,
        count: data.count,
        timestamp: data.timestamp,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
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
      <div className="bg-primary-background text-primary-text rounded-lg p-4">
        <h2 className="text-xl font-semibold text-center mb-4">Top Gaming Days</h2>
        <div className="text-center text-primary-text p-4">
          <p>No games data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary-background text-primary-text rounded-lg p-4 max-w-96">
      <h2 className="text-xl font-semibold text-center mb-4">Top Gaming Days</h2>

      <div className="space-y-3">
        {topDays.map((day, index) => (
          <div
            key={day.date}
            className="flex items-center justify-between py-1 px-3 bg-secondary-background rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-background text-primary-text font-bold">
                {index + 1}
              </div>
              <div>
                <p className="font-medium text-secondary-text capitalize">{formatDate(day.date)}</p>
                <p className="text-sm text-secondary-text">{relativeTimeString(new Date(day.timestamp))}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-secondary-text">{day.count}</p>
              <p className="text-sm text-secondary-text opacity-75">{day.count === 1 ? "game" : "games"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
