import React, { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { useEventDbContext } from "../../wrappers/event-db-context";

interface MonthlyData {
  month: string;
  count: number;
  timestamp: number;
}

export const GamesPerMonthChart: React.FC = () => {
  const context = useEventDbContext();

  const { monthlyData, tournamentsInRange } = useMemo(() => {
    if (context.games.length === 0) {
      return { monthlyData: [], tournamentsInRange: [] };
    }

    const monthlyGameCounts = new Map<string, { count: number; timestamp: number }>();

    // First pass: collect actual game data
    context.games.forEach(({ playedAt }) => {
      const date = new Date(playedAt);
      const year = date.getFullYear();
      const month = date.getMonth();

      // Create a key for the month (YYYY-MM format)
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

      // Create a timestamp for the first day of that month for sorting
      const monthTimestamp = new Date(year, month, 1).getTime();

      if (monthlyGameCounts.has(monthKey)) {
        monthlyGameCounts.get(monthKey)!.count++;
      } else {
        monthlyGameCounts.set(monthKey, { count: 1, timestamp: monthTimestamp });
      }
    });

    // Find the date range
    const timestamps = Array.from(monthlyGameCounts.values()).map((data) => data.timestamp);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    // Generate all months in the range
    const allMonthsData: MonthlyData[] = [];
    const startDate = new Date(minTimestamp);
    const endDate = new Date(maxTimestamp);

    const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
      const monthTimestamp = new Date(year, month, 1).getTime();

      // Use actual count if exists, otherwise 0
      const count = monthlyGameCounts.get(monthKey)?.count || 0;

      allMonthsData.push({
        month: monthKey,
        count,
        timestamp: monthTimestamp,
      });

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    const sortedMonthlyData = allMonthsData.sort((a, b) => a.timestamp - b.timestamp);

    // Filter tournaments that fall within the data range
    const tournaments = context.client.tournaments;
    const tournamentsInRange = tournaments.filter((tournament) => {
      return tournament.startDate >= minTimestamp && tournament.startDate <= Date.now();
    });

    return { monthlyData: sortedMonthlyData, tournamentsInRange };
  }, [context.games, context.client?.tournaments]);

  // Format month for display
  const formatMonth = (monthString: string): string => {
    const [year, month] = monthString.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  // Convert tournament timestamp to month key for positioning
  const getTournamentMonthKey = (timestamp: number): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth();
    return `${year}-${String(month + 1).padStart(2, "0")}`;
  };

  if (monthlyData.length === 0) {
    return (
      <div className="text-center text-primary-text p-8">
        <p>No games data available</p>
      </div>
    );
  }

  return (
    <div className="bg-primary-background text-primary-text rounded-lg">
      <h2 className="text-xl font-semibold text-center mb-4">Games per month</h2>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={monthlyData} margin={{ top: 20, right: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-primary-text))" opacity={0.3} />

          <XAxis
            dataKey="month"
            stroke="rgb(var(--color-primary-text))"
            tickFormatter={formatMonth}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />

          <YAxis stroke="rgb(var(--color-primary-text))" tickFormatter={(value) => value.toString()} />

          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length > 0) {
                const data = payload[0].payload as MonthlyData;
                return (
                  <div className="bg-secondary-background text-secondary-text p-3 rounded-lg shadow-lg border border-secondary-text">
                    <p className="font-semibold">{formatMonth(label as string)}</p>
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
              x={getTournamentMonthKey(tournament.startDate)}
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
        Total games: {context.games.length} | Months displayed: {monthlyData.length} | Tournaments:{" "}
        {tournamentsInRange.length}
      </div>
    </div>
  );
};
