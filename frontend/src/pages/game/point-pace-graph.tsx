import React from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { readableOn } from "../../common/color-utils";
import { ROW_SURFACE } from "../../common/player-color-styles";
import { PacePoint } from "./game-tracking-stats";

type Props = {
  pace: PacePoint[];
  winnerName: string;
  loserName: string;
  winnerColor: string;
  loserColor: string;
};

/**
 * How long each point took, one bar per point, under the win % graph and on the
 * same point scale. The bar is coloured by who won the point, so a run of long
 * points and who took them read together.
 *
 * The first point of a set has no bar: the time before it is the break after
 * the previous set, not the pace of the game. The set table carries that.
 */
export const PointPaceGraph: React.FC<Props> = ({ pace, winnerName, loserName, winnerColor, loserColor }) => {
  const timed = pace.filter((point) => point.seconds !== null);
  if (timed.length < 2) return null;

  // Player colours run from near-black to near-white, so darken pale ones the
  // same way the score text and the win % line do.
  const winnerFill = readableOn(winnerColor, ROW_SURFACE);
  const loserFill = readableOn(loserColor, ROW_SURFACE);

  const data = pace.map((point) => ({
    ...point,
    // Recharts skips a null bar, which keeps the x scale aligned with the win %
    // graph above: both count every point of the game.
    winnerSeconds: point.scoredBy === "W" ? point.seconds : null,
    loserSeconds: point.scoredBy === "L" ? point.seconds : null,
  }));

  // The last point of each set, so a line can mark where the set ended.
  const setBoundaries = pace
    .filter((point, index) => pace[index + 1] && pace[index + 1].set !== point.set)
    .map((point) => point.point);

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-base font-bold text-gray-800 mb-1">Time per point</h3>
      <p className="text-xs text-gray-500 mb-2">Seconds since the previous point, coloured by who won it</p>

      {/* Two series, so identity never rests on colour alone. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-gray-600">
        <LegendKey color={winnerFill} name={winnerName} />
        <LegendKey color={loserFill} name={loserName} />
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="point" type="category" tick={false} axisLine={{ stroke: "#d1d5db" }} height={4} />
          <YAxis
            tickFormatter={(value) => `${value}s`}
            tick={{ fontSize: 10, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            width={34}
          />
          <Tooltip
            animationDuration={0}
            cursor={{ fill: "#00000010" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const point = payload[0].payload as PacePoint;
              if (point.seconds === null) return null;
              return (
                <div className="rounded-lg bg-white p-2 text-xs text-gray-700 shadow ring-1 ring-gray-300">
                  <p className="font-semibold">
                    Point {point.point} · Set {point.set}
                  </p>
                  <p>
                    {point.seconds.toFixed(1)}s to {point.scoredBy === "W" ? winnerName : loserName}
                  </p>
                </div>
              );
            }}
          />
          {/* The win % graph above marks the same boundaries with a label, so
              these lines only have to line up with it. A second set of labels
              collides with a tall bar and says nothing new. */}
          {setBoundaries.map((boundary) => (
            <ReferenceLine key={boundary} x={boundary} stroke="#9ca3af" strokeDasharray="4 4" />
          ))}
          {/* One stack, so the 2 series share a slot and every bar sits on the
              same baseline. Only 1 of them has a value for a given point. */}
          <Bar dataKey="winnerSeconds" stackId="point" fill={winnerFill} radius={[2, 2, 0, 0]} maxBarSize={24} />
          <Bar dataKey="loserSeconds" stackId="point" fill={loserFill} radius={[2, 2, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const LegendKey: React.FC<{ color: string; name: string }> = ({ color, name }) => (
  <span className="flex items-center gap-1.5 min-w-0">
    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
    <span className="truncate">{name}</span>
  </span>
);
