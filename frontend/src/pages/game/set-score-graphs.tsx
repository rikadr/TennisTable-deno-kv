import React from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { markOn, ROW_SURFACE } from "../../common/player-color-styles";
import { ChartLegendKey } from "./chart-legend";
import { ScoreStep, SetProgression } from "./game-tracking-stats";

type Props = {
  progressions: SetProgression[];
  winnerName: string;
  loserName: string;
  winnerColor: string;
  loserColor: string;
};

/**
 * The points of both players through each set, one square graph per set. A line
 * climbs by 1 for every point its player wins, so the gap between the two lines
 * is the lead and a steep run is a streak.
 *
 * Each set is its own square, so the sets read as small multiples of the same
 * shape. The scale of a square is the set it holds, not the whole game.
 */
export const SetScoreGraphs: React.FC<Props> = ({ progressions, winnerName, loserName, winnerColor, loserColor }) => {
  if (progressions.length === 0) return null;

  // Each player's own colour, the one they have everywhere else in the app.
  const winnerStroke = markOn(winnerColor, ROW_SURFACE);
  const loserStroke = markOn(loserColor, ROW_SURFACE);

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-base font-bold text-gray-800 mb-1">Points through each set</h3>
      <p className="text-xs text-gray-500 mb-2">
        The points of both players after every point of the set. The gap between the lines is the lead.
      </p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-600">
        <ChartLegendKey color={winnerStroke} name={winnerName} />
        <ChartLegendKey color={loserStroke} name={loserName} dashed />
      </div>

      {/* The app's custom xs breakpoint is emitted after the default ones, so
          an xs class here would beat md at every width. Default breakpoints
          only, so the columns grow with the screen. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-4">
        {progressions.map((set) => (
          <SetSquare
            key={set.set}
            set={set}
            winnerName={winnerName}
            loserName={loserName}
            winnerStroke={winnerStroke}
            loserStroke={loserStroke}
          />
        ))}
      </div>
    </div>
  );
};

const SetSquare: React.FC<{
  set: SetProgression;
  winnerName: string;
  loserName: string;
  winnerStroke: string;
  loserStroke: string;
}> = ({ set, winnerName, loserName, winnerStroke, loserStroke }) => {
  const pointsPlayed = set.steps.length - 1;
  // The taller score sets the top of the y axis, so both lines fit and the
  // winning line ends in the top right corner of the square.
  const topScore = Math.max(set.final.winner, set.final.loser, 1);

  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-gray-700 mb-0.5 truncate">
        Set {set.set} · {set.final.winner}-{set.final.loser} {set.wonByGameWinner ? "🏆" : ""}
      </p>
      <ResponsiveContainer width="100%" aspect={1}>
        <LineChart data={set.steps} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
          <XAxis
            dataKey="played"
            type="number"
            domain={[0, pointsPlayed]}
            allowDecimals={false}
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            axisLine={{ stroke: "#d1d5db" }}
            tickLine={false}
            height={16}
          />
          <YAxis
            domain={[0, topScore]}
            allowDecimals={false}
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={18}
          />
          <Tooltip
            animationDuration={0}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const step = payload[0].payload as ScoreStep;
              return (
                <div className="rounded-lg bg-white p-2 text-xs text-gray-700 shadow ring-1 ring-gray-300">
                  <p className="font-semibold">
                    {step.played === 0 ? "Before the set" : `After ${step.played} points`}
                  </p>
                  <p>
                    {winnerName} {step.winner} - {step.loser} {loserName}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="linear"
            dataKey="winner"
            stroke={winnerStroke}
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
          <Line
            type="linear"
            dataKey="loser"
            stroke={loserStroke}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
