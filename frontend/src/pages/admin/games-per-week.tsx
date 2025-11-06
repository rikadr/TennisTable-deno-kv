import React, { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { useEventDbContext } from "../../wrappers/event-db-context";

interface WeeklyData {
  week: string;
  count: number;
  timestamp: number;
}

export const GamesPerWeekChart: React.FC = () => {
  const context = useEventDbContext();

  const { weeklyData, tournamentsInRange } = useMemo(() => {
    if (context.games.length === 0) {
      return { weeklyData: [], tournamentsInRange: [] };
    }

    const weeklyGameCounts = new Map<string, { count: number; timestamp: number }>();

    // Helper function to get the start of the week (Monday)
    const getWeekStart = (date: Date): Date => {
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      return new Date(date.getFullYear(), date.getMonth(), diff);
    };

    // First pass: collect actual game data
    context.games.forEach(({ playedAt }) => {
      const date = new Date(playedAt);
      const weekStart = getWeekStart(date);

      // Create a key for the week (YYYY-MM-DD format of week start)
      const weekKey = weekStart.toISOString().split("T")[0];
      const weekTimestamp = weekStart.getTime();

      if (weeklyGameCounts.has(weekKey)) {
        weeklyGameCounts.get(weekKey)!.count++;
      } else {
        weeklyGameCounts.set(weekKey, { count: 1, timestamp: weekTimestamp });
      }
    });

    // Find the date range
    const timestamps = Array.from(weeklyGameCounts.values()).map((data) => data.timestamp);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    // Generate all weeks in the range
    const allWeeksData: WeeklyData[] = [];
    const startWeek = new Date(minTimestamp);
    const endWeek = new Date(maxTimestamp);

    const currentWeek = new Date(startWeek);

    while (currentWeek <= endWeek) {
      const weekKey = currentWeek.toISOString().split("T")[0];
      const weekTimestamp = currentWeek.getTime();

      // Use actual count if exists, otherwise 0
      const count = weeklyGameCounts.get(weekKey)?.count || 0;

      allWeeksData.push({
        week: weekKey,
        count,
        timestamp: weekTimestamp,
      });

      // Move to next week
      currentWeek.setDate(currentWeek.getDate() + 7);
    }

    const sortedWeeklyData = allWeeksData.sort((a, b) => a.timestamp - b.timestamp);

    // Filter tournaments that fall within the data range
    const tournaments = context.client?.tournaments;
    const tournamentsInRange = tournaments.filter((tournament) => {
      return tournament.startDate >= minTimestamp && tournament.startDate <= Date.now();
    });

    return { weeklyData: sortedWeeklyData, tournamentsInRange };
  }, [context.games, context.client?.tournaments]);

  // Format week for display
  const formatWeek = (weekString: string): string => {
    const date = new Date(weekString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Convert tournament timestamp to week key for positioning
  const getTournamentWeekKey = (timestamp: number): string => {
    const date = new Date(timestamp);
    const getWeekStart = (date: Date): Date => {
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(date.getFullYear(), date.getMonth(), diff);
    };
    const weekStart = getWeekStart(date);
    return weekStart.toISOString().split("T")[0];
  };

  if (weeklyData.length === 0) {
    return (
      <div className="text-center text-primary-text p-8">
        <p>No games data available</p>
      </div>
    );
  }

  return (
    <div className="bg-primary-background text-primary-text rounded-lg">
      <h2 className="text-xl font-semibold text-center mb-4">Games per week</h2>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={weeklyData} margin={{ top: 20, right: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-primary-text))" opacity={0.3} />

          <XAxis
            dataKey="week"
            stroke="rgb(var(--color-primary-text))"
            tickFormatter={formatWeek}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />

          <YAxis stroke="rgb(var(--color-primary-text))" tickFormatter={(value) => value.toString()} />

          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length > 0) {
                const data = payload[0].payload as WeeklyData;
                const weekStart = new Date(label as string);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);

                return (
                  <div className="bg-secondary-background text-secondary-text p-3 rounded-lg shadow-lg border border-secondary-text">
                    <p className="font-semibold">
                      {formatWeek(label as string)} - {formatWeek(weekEnd.toISOString().split("T")[0])}
                    </p>
                    <p>{`Games: ${data.count}`}</p>
                  </div>
                );
              }
              return null;
            }}
          />

          {/* Tournament Reference Lines */}
          {tournamentsInRange.map((tournament, index) => (
            <ReferenceLine
              key={`tournament-${index}`}
              x={getTournamentWeekKey(tournament.startDate)}
              stroke="rgb(var(--color-tertiary-background))"
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{
                value: tournament.name,
                angle: -5,
                textAnchor: "end",
                position: "insideTopRight",
                offset: 10,
                style: {
                  fontSize: "12px",
                  fill: "rgb(var(--color-tertiary-background))",
                },
              }}
            />
          ))}

          <Line
            type="monotone"
            dataKey="count"
            stroke="rgb(var(--color-secondary-background))"
            strokeWidth={3}
            dot={{
              fill: "rgb(var(--color-secondary-background))",
              strokeWidth: 2,
              r: 4,
            }}
            activeDot={{
              r: 6,
              fill: "rgb(var(--color-tertiary-background))",
            }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-sm text-center opacity-75">
        Total games: {context.games.length} | Weeks displayed: {weeklyData.length} | Tournaments:{" "}
        {tournamentsInRange.length}
      </div>
    </div>
  );
};
