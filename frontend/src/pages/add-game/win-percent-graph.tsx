import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { readableOn } from "../../common/color-utils";
import { ROW_SURFACE } from "../../common/player-color-styles";
import { fmtNum } from "../../common/number-utils";

type Props = {
  /** Player 1's match-win chance after each point, in game order, [0, 1]. */
  history: number[];
  winnerIsPlayer1: boolean;
  winnerName: string;
  winnerColor: string;
  completedSets: { player1: number; player2: number }[];
};

/**
 * The winner's live win% over the tracked game, one sample per point, shown on
 * the summary screen. Vertical lines mark where each set ended and a horizontal
 * line marks 50%.
 */
export const WinPercentGraph: React.FC<Props> = ({
  history,
  winnerIsPlayer1,
  winnerName,
  winnerColor,
  completedSets,
}) => {
  if (history.length < 2) return null;

  const data = history.map((player1WinChance, index) => ({
    point: index + 1,
    winPercent: (winnerIsPlayer1 ? player1WinChance : 1 - player1WinChance) * 100,
  }));

  // Where each set ended, as a point count from the start of the game.
  let pointsPlayed = 0;
  const setBoundaries = completedSets.map((set, index) => {
    pointsPlayed += set.player1 + set.player2;
    return { point: pointsPlayed, label: `Set ${index + 1}` };
  });

  // Player colours run from near-black to near-white, so darken pale ones the
  // same way the score text does.
  const lineColor = readableOn(winnerColor, ROW_SURFACE);

  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-6">
      <h3 className="text-base font-bold text-gray-800 mb-1">Win % over the game</h3>
      <p className="text-xs text-gray-500 mb-2">{winnerName}'s chance to win, after every point</p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="#d1d5db" />
          <XAxis
            dataKey="point"
            type="number"
            domain={[1, "dataMax"]}
            tick={false}
            axisLine={{ stroke: "#d1d5db" }}
            height={4}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 10, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            width={34}
          />
          <Tooltip
            animationDuration={0}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div className="rounded-lg bg-white p-2 text-xs text-gray-700 shadow ring-1 ring-gray-300">
                  <p className="font-semibold">Point {label}</p>
                  <p>
                    {winnerName}: {fmtNum(payload[0].value as number)}% win chance
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine y={50} stroke="#9ca3af" strokeDasharray="4 4" />
          {setBoundaries.map((boundary) => (
            <ReferenceLine
              key={boundary.label}
              x={boundary.point}
              stroke="#9ca3af"
              strokeDasharray="4 4"
              label={{ value: boundary.label, position: "insideTop", fill: "#6b7280", fontSize: 10 }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="winPercent"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
