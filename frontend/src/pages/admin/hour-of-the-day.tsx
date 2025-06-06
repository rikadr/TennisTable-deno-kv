import React, { useMemo } from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { useEventDbContext } from "../../wrappers/event-db-context";

export const GamesPerTimeChart: React.FC = () => {
  const context = useEventDbContext();

  const timeData = useMemo(() => {
    if (context.games.length === 0) {
      return [];
    }

    // Find earliest and latest game times
    let minSlotIndex = 96;
    let maxSlotIndex = -1;
    const timeCounts = new Map<number, number>();

    // Count games for each 15-minute time slot and find range
    context.games.forEach(({ playedAt }) => {
      const date = new Date(playedAt);
      const hours = date.getHours();
      const minutes = date.getMinutes();

      // Convert to 15-minute slot index (0-95)
      const slotIndex = Math.floor((hours * 60 + minutes) / 15);

      minSlotIndex = Math.min(minSlotIndex, slotIndex);
      maxSlotIndex = Math.max(maxSlotIndex, slotIndex);

      timeCounts.set(slotIndex, (timeCounts.get(slotIndex) || 0) + 1);
    });

    // Initialize counts for all slots within the range (including gaps with 0 games)
    for (let i = minSlotIndex; i <= maxSlotIndex; i++) {
      if (!timeCounts.has(i)) {
        timeCounts.set(i, 0);
      }
    }

    // Convert to array format for the chart, only within the range
    const result = [];
    for (let slotIndex = minSlotIndex; slotIndex <= maxSlotIndex; slotIndex++) {
      // Convert slot index back to time string
      const totalMinutes = slotIndex * 15;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const timeSlot = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

      result.push({
        timeSlot,
        count: timeCounts.get(slotIndex) || 0,
        slotIndex,
      });
    }

    return result;
  }, [context.games]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      const slotIndex = payload[0].payload.slotIndex;
      const startTime = label;

      // Calculate end time
      const totalMinutes = (slotIndex + 1) * 15;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      const endTime = `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;

      return (
        <div className="bg-secondary-background text-secondary-text p-3 rounded-lg shadow-lg border border-secondary-text">
          <p className="font-semibold">
            {startTime} - {endTime}
          </p>
          <p>{`Spill: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  if (timeData.length === 0) {
    return (
      <div className="text-center text-primary-text p-8">
        <p>No games data available</p>
      </div>
    );
  }

  return (
    <div className="bg-primary-background text-primary-text rounded-lg p-4">
      <h2 className="text-xl font-semibold text-center mb-4">Games per hour of the day</h2>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={timeData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-primary-text))" opacity={0.3} />

          <XAxis
            dataKey="timeSlot"
            stroke="rgb(var(--color-primary-text))"
            tick={{ fontSize: 10 }}
            interval={Math.max(Math.floor(timeData.length / 12), 3)} // Show roughly 12 labels
          />

          <YAxis stroke="rgb(var(--color-primary-text))" tick={{ fontSize: 12 }} />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgb(var(--color-primary-text))", fillOpacity: 0.1 }} />

          <Bar dataKey="count" stroke="rgb(var(--color-tertiary-background))" strokeWidth={1}>
            {timeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="rgb(var(--color-secondary-background))" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
