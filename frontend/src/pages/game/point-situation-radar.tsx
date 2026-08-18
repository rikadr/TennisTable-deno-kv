import React from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { markOn, ROW_SURFACE } from "../../common/player-color-styles";
import { ChartLegendKey } from "./chart-legend";
import { fmtNum } from "../../common/number-utils";
import { PointSituation } from "./game-tracking-stats";

type Props = {
  situations: PointSituation[];
  winnerName: string;
  loserName: string;
  winnerColor: string;
  loserColor: string;
};

/**
 * How each player did in the situations of the game, on one shape per player.
 * Every axis is the percent of that situation's points the player won, so the
 * two shapes read on the same scale: a shape that reaches past the middle ring
 * on an axis is the player who owned that situation.
 *
 * The other graphs on the page follow the game point by point. This one holds
 * the whole game still, so the strength of each player is one shape.
 */
export const PointSituationRadar: React.FC<Props> = ({
  situations,
  winnerName,
  loserName,
  winnerColor,
  loserColor,
}) => {
  // Three axes is the least a shape can be read from. Fewer means the game was
  // too short for the situations to hold points on both sides.
  if (situations.length < 3) return null;

  // Each player's own colour, the one they have everywhere else in the app.
  const winnerStroke = markOn(winnerColor, ROW_SURFACE);
  const loserStroke = markOn(loserColor, ROW_SURFACE);

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-base font-bold text-gray-800 mb-1">Points won by situation</h3>
      <p className="text-xs text-gray-500 mb-2">The percent of each situation's points the player won.</p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-1 text-xs text-gray-600">
        <ChartLegendKey color={winnerStroke} name={winnerName} />
        <ChartLegendKey color={loserStroke} name={loserName} dashed />
      </div>

      <div className="max-w-xl mx-auto">
        <ResponsiveContainer width="100%" height={330}>
          <RadarChart data={situations} outerRadius="72%" margin={{ top: 14, right: 8, left: 8, bottom: 6 }}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="label" tick={<AxisLabel />} />
            {/* The rings are the scale: 0, 50 and 100 percent. Their labels sit
                on the gap between two axes, away from the axis marks. */}
            <PolarRadiusAxis domain={[0, 100]} tickCount={3} angle={126} axisLine={false} tick={<RingLabel />} />
            <Tooltip
              animationDuration={0}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const situation = payload[0].payload as PointSituation;
                return (
                  <div className="rounded-lg bg-white p-2 text-xs text-gray-700 shadow ring-1 ring-gray-300">
                    <p className="font-semibold">{situation.label}</p>
                    <p className="text-gray-500 mb-1">{situation.description}</p>
                    <SituationRow name={winnerName} percent={situation.winner} of={situation.winnerOf} />
                    <SituationRow name={loserName} percent={situation.loser} of={situation.loserOf} />
                  </div>
                );
              }}
            />
            {/* The 2 fills stack where the shapes overlap, so both stay pale. */}
            <Radar
              name={winnerName}
              dataKey="winner"
              stroke={winnerStroke}
              strokeWidth={2}
              fill={winnerStroke}
              fillOpacity={0.15}
              animationDuration={300}
            />
            <Radar
              name={loserName}
              dataKey="loser"
              stroke={loserStroke}
              strokeWidth={2}
              strokeDasharray="5 3"
              fill={loserStroke}
              fillOpacity={0.1}
              animationDuration={300}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/**
 * One ring of the scale, named on the gap between two axes. The 0% ring is the
 * centre point, where a label would only sit under the shapes, so it has none.
 */
const RingLabel: React.FC<{ x?: number; y?: number; payload?: { value: number } }> = ({ x, y, payload }) => {
  if (payload === undefined || payload.value === 0) return null;
  return (
    <text
      x={x}
      y={y}
      dy={3}
      textAnchor="middle"
      fontSize={9}
      fill="#9ca3af"
      // A shape that reaches past the ring crosses its label, so the label
      // carries the surface colour around itself and stays readable.
      stroke={ROW_SURFACE}
      strokeWidth={3}
      paintOrder="stroke"
    >
      {payload.value}%
    </text>
  );
};

/**
 * The name of one axis. Every name is 2 words, and a narrow phone has no room
 * for both of them on one line on the left and the right axes, so each name
 * takes 2 lines. A name above the centre grows upwards, away from the chart.
 */
const AxisLabel: React.FC<{
  x?: number;
  y?: number;
  cy?: number;
  textAnchor?: "inherit" | "start" | "end" | "middle";
  payload?: { value: string };
}> = ({ x, y, cy, textAnchor, payload }) => {
  if (payload === undefined) return null;
  const [first, ...rest] = payload.value.split(" ");
  const second = rest.join(" ");
  const above = cy !== undefined && y !== undefined && y < cy;

  return (
    <text x={x} y={y} textAnchor={textAnchor} fontSize={10} fill="#6b7280">
      <tspan x={x} dy={second === "" ? 4 : above ? -6 : 3}>
        {first}
      </tspan>
      {second !== "" && (
        <tspan x={x} dy={11}>
          {second}
        </tspan>
      )}
    </text>
  );
};

const SituationRow: React.FC<{ name: string; percent: number | null; of: number }> = ({ name, percent, of }) => (
  <p>
    {name}: {percent === null ? "–" : `${fmtNum(percent)}%`} of {of} {of === 1 ? "point" : "points"}
  </p>
);
