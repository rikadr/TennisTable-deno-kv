import React, { useMemo } from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useEventDbContext } from "../../wrappers/event-db-context";

export const GamesPerWeekdayChart: React.FC = () => {
  const context = useEventDbContext();

  const weekdayData = useMemo(() => {
    if (context.games.length === 0) {
      return [];
    }

    // Norwegian weekday names
    const norwegianWeekdays = ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"];

    // Initialize counts for all weekdays
    const weekdayCounts = new Map<number, number>();
    for (let i = 0; i < 7; i++) {
      weekdayCounts.set(i, 0);
    }

    // Count games for each day of the week
    context.games.forEach(({ playedAt }) => {
      const date = new Date(playedAt);
      let dayOfWeek = date.getDay();

      // Convert from Sunday=0 to Monday=0 format
      dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      weekdayCounts.set(dayOfWeek, (weekdayCounts.get(dayOfWeek) || 0) + 1);
    });

    // Convert to array format for the chart
    return Array.from(weekdayCounts.entries()).map(([dayIndex, count]) => ({
      weekday: norwegianWeekdays[dayIndex],
      count,
      dayIndex,
    }));
  }, [context.games]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-secondary-background text-secondary-text p-3 rounded-lg shadow-lg border border-secondary-text">
          <p className="font-semibold capitalize">{label}</p>
          <p>{`Games: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  if (weekdayData.length === 0) {
    return (
      <div className="text-center text-primary-text p-8">
        <p>No games data available</p>
      </div>
    );
  }

  return (
    <div className="bg-primary-background text-primary-text rounded-lg p-4">
      <h2 className="text-xl font-semibold text-center mb-4">Games per weekday</h2>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={weekdayData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-primary-text))" opacity={0.3} />

          <XAxis
            dataKey="weekday"
            stroke="rgb(var(--color-primary-text))"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
          />

          <YAxis stroke="rgb(var(--color-primary-text))" tick={{ fontSize: 12 }} />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgb(var(--color-primary-text))", fillOpacity: 0.1 }} />

          <Bar
            dataKey="count"
            fill="rgb(var(--color-secondary-background))"
            stroke="rgb(var(--color-tertiary-background))"
            strokeWidth={1}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
