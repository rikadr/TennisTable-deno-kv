import React, { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useWindowSize } from "usehooks-ts";
import { useEventDbContext } from "../../wrappers/event-db-context";

import { stringToColor } from "../../common/string-to-color";
import { Elo } from "../../client/client-db/elo";
import { relativeTimeString } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";
import { useEloSimulationWorker } from "../../hooks/use-elo-simulation-worker";
import { Shimmer } from "../../common/shimmer";
import { classNames } from "../../common/class-names";

export const PlayerEloGraph: React.FC<{ playerId: string; isReadOnly?: boolean }> = ({ playerId, isReadOnly = false }) => {
  const context = useEventDbContext();
  const summary = context.leaderboard.getPlayerSummary(playerId || "");

  const { width = 0 } = useWindowSize();

  const [zoomLevel, setZoomLevel] = useState(100); // Percentage of data to show
  const [panPosition, setPanPosition] = useState(100); // Position from 0-100, where 100 is the end (most recent)
  const [showExpectedElo, setShowExpectedElo] = useState(false);
  const { startSimulation, simulatedElos, simulationProgress, simulationIsDone } = useEloSimulationWorker();

  const graphGames: ((typeof summary.games)[number] & { simulatedElo?: number; simulatedEloDiff?: number })[] =
    useMemo(() => {
      const games = [...summary.games];
      if (showExpectedElo) {
        const firstRankedGameTime = games[context.client.gameLimitForRanked - 1].time;
        const entries: ((typeof summary.games)[number] & { simulatedElo?: number; simulatedEloDiff?: number })[] = [
          { eloAfterGame: Elo.INITIAL_ELO, pointsDiff: 0, time: 0 },
        ];
        const allGameTimes = new Set<number>([...games.map((g) => g.time), ...simulatedElos.map((s) => s.time)]);
        for (const gameTime of Array.from(allGameTimes).sort((a, b) => a - b)) {
          const realGame = games.find((g) => g.time === gameTime);
          const simulatedElo = simulatedElos.find((g) => g.time === gameTime);
          if (!realGame && !simulatedElo) continue; // Verify if return is more correct
          let newEntry = { ...entries[entries.length - 1] };
          if (realGame) {
            newEntry = { ...newEntry, ...realGame, score: undefined };
          } else {
            newEntry.oponent = undefined;
            newEntry.pointsDiff = 0;
            newEntry.result = undefined;
          }
          if (gameTime > firstRankedGameTime) {
            if (simulatedElo) {
              newEntry.time = simulatedElo.time;
              newEntry.simulatedEloDiff = simulatedElo.elo - (newEntry.simulatedElo ?? 0);
              newEntry.simulatedElo = simulatedElo.elo;
            } else {
              newEntry.simulatedEloDiff = 0;
            }
          }
          entries.push(newEntry);
        }

        return entries;
      }
      games.unshift({ eloAfterGame: Elo.INITIAL_ELO, pointsDiff: 0, time: 0 });

      return games;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showExpectedElo, simulatedElos, playerId]);

  if (summary.games.length === 0) {
    return null;
  }

  const playerPlayedTheLastGame = graphGames[graphGames.length - 1].oponent !== undefined;
  const lastGame = graphGames[graphGames.length - (playerPlayedTheLastGame ? 1 : 2)];
  const entryBeforeLastGame = graphGames[graphGames.length - (playerPlayedTheLastGame ? 2 : 3)];
  const lastEntry = graphGames[graphGames.length - 1];

  // Calculate visible range based on zoom and pan
  const totalGames = graphGames.length;
  const visibleCount = Math.max(10, Math.ceil((totalGames * zoomLevel) / 100));
  const maxStartIndex = Math.max(0, totalGames - visibleCount);
  const startIndex = Math.floor((panPosition / 100) * maxStartIndex);
  const endIndex = Math.min(totalGames, startIndex + visibleCount);
  const visibleGames = graphGames.slice(startIndex, endIndex);

  const zoomPresets = [
    { label: "All", value: 100 },
    { label: "50%", value: 50 },
    { label: "25%", value: 25 },
    { label: "10%", value: 10 },
  ];

  return (
    <>
      <ResponsiveContainer width="100%" height={width > 768 ? 350 : 300}>
        <LineChart
          data={visibleGames}
          margin={{ top: 5, right: 0, left: -12 }}
        >
          <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="rgb(var(--color-primary-text))" opacity={1} />
          <YAxis
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value) => value.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
            stroke="rgb(var(--color-primary-text))"
          />
          <XAxis dataKey="name" stroke="rgb(var(--color-primary-text))" />
          <Tooltip
            formatter={(value) => [value.toLocaleString("no-NO", { maximumFractionDigits: 0 }), "Elo"]}
            wrapperClassName="rounded-lg"
            animationDuration={0}
            content={<CustomTooltip />}
          />
          {["stroke", "main"].map((type) => {
            return (
              <Line
                key={type}
                type="monotone"
                dataKey="eloAfterGame"
                stroke={type === "main" ? "white" : stringToColor(playerId)}
                dot={false}
                animationDuration={100}
                strokeWidth={type === "main" ? 0.5 : 5}
              />
            );
          })}

          <Line
            type="monotone"
            dataKey="simulatedElo"
            stroke="rgb(var(--color-primary-text))"
            dot={false}
            animationDuration={100}
            strokeWidth={0.5}
          />

          <ReferenceLine
            y={1000}
            stroke="rgb(var(--color-primary-text))"
            label={{ value: "1 000", position: "insideBottom", fill: "rgb(var(--color-primary-text))" }}
            color="#"
          />
        </LineChart>
      </ResponsiveContainer>

      {graphGames.length > 50 && (
        <div className="space-y-3 mb-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary-text whitespace-nowrap">Zoom:</span>
            <div className="flex gap-1">
              {zoomPresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => {
                    setZoomLevel(preset.value);
                    // Reset pan to end when zooming
                    setPanPosition(100);
                  }}
                  className={classNames(
                    "px-3 py-1 rounded text-sm font-medium transition-colors",
                    zoomLevel === preset.value
                      ? "bg-secondary-background text-secondary-text"
                      : "bg-primary-background text-primary-text border border-primary-text/20 hover:bg-secondary-background/50"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pan Slider (only show when zoomed in) */}
          {zoomLevel < 100 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary-text whitespace-nowrap">Pan:</span>
              <input
                className="w-full"
                type="range"
                min={0}
                max={100}
                value={panPosition}
                onChange={(e) => setPanPosition(Number(e.target.value))}
              />
            </div>
          )}
        </div>
      )}
      {!isReadOnly && !showExpectedElo && summary.games.length >= context.client.gameLimitForRanked && (
        <button
          className="mb-4 px-2 py-1 bg-secondary-background text-secondary-text hover:bg-secondary-background/50 rounded-lg"
          onClick={() =>
            setShowExpectedElo((prev) => {
              const newValue = !prev;
              if (newValue) {
                startSimulation(playerId);
              }
              return newValue;
            })
          }
        >
          Simulate expected score
        </button>
      )}
      {showExpectedElo && simulationIsDone === false && <ProgressBar progress={simulationProgress} />}
      {showExpectedElo && lastEntry.simulatedElo && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-w-[800px] gap-x-4 text-primary-text">
          <div className="p-1">
            <p className="text-sm mb-1 whitespace-nowrap">Expected score</p>
            <p className="text-2xl font-bold">{fmtNum(lastEntry.simulatedElo)}</p>
          </div>
          <div className="p-1">
            <p className="text-sm mb-1 whitespace-nowrap">Distance from current</p>
            <p className="text-2xl font-bold">
              {fmtNum(lastEntry.simulatedElo! - lastEntry.eloAfterGame, { signedPositive: true, digits: 0 })}{" "}
              {lastEntry.simulatedElo! - lastEntry.eloAfterGame > 0 ? "↗" : "↘"}
            </p>
          </div>
          {summary.games.length >= context.client.gameLimitForRanked + 1 &&
            entryBeforeLastGame?.simulatedElo &&
            lastGame.simulatedElo && (
              <div className="p-1">
                <p className="text-sm mb-1 whitespace-nowrap">Last game</p>
                <p className="text-2xl font-bold">
                  {fmtNum(lastGame.simulatedElo - entryBeforeLastGame.simulatedElo, {
                    digits: 0,
                    signedPositive: true,
                  })}{" "}
                  {lastGame.simulatedElo - entryBeforeLastGame.simulatedElo > 0 ? "↗" : "↘"}
                </p>
              </div>
            )}
          {lastGame.simulatedElo && lastEntry.simulatedElo && (
            <div className="p-1">
              <p className="text-sm mb-1 whitespace-nowrap">Since your last game</p>
              <p className="text-2xl font-bold">
                {lastGame.time === lastEntry.time
                  ? "-"
                  : fmtNum(lastEntry.simulatedElo - lastGame.simulatedElo, {
                      digits: 0,
                      signedPositive: true,
                    })}{" "}
                {lastGame.time !== lastEntry.time && (lastEntry.simulatedElo - lastGame.simulatedElo > 0 ? "↗" : "↘")}
              </p>
            </div>
          )}
        </div>
      )}
      {showExpectedElo && (
        <div className="mt-4">
          <p className="text-xs">* Simulation has some randomness every time.</p>
          <p className="text-xs">Might fluctuate wildly when too little data (few games)</p>
          <p className="text-xs">or when the total points pool increases by more players becomeing ranked</p>
        </div>
      )}
    </>
  );
};

const CustomTooltip: React.FC = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  const constext = useEventDbContext();
  if (active && payload && payload.length) {
    const game = payload[0].payload;
    return (
      <div className="p-2 bg-primary-background ring-1 ring-primary-text rounded-lg text-primary-text">
        <p>Score: {fmtNum(payload[0].value as number, { digits: 0 })} </p>

        {game?.result ? (
          <p className="desc">
            {game.result === "win"
              ? `🏆 +${fmtNum(game.pointsDiff, { digits: 0 })} from`
              : `💔 ${fmtNum(game.pointsDiff, { digits: 0 })} to`}{" "}
            {constext.playerName(game.oponent)}
          </p>
        ) : (
          <p className="text-primary-text/50">In between your games</p>
        )}
        {game.simulatedElo && game.simulatedEloDiff && (
          <p>
            Simulated: {fmtNum(game.simulatedElo, { digits: 0 })} (
            {fmtNum(game.simulatedEloDiff, { signedPositive: true, digits: 0 })})
          </p>
        )}
        {game.time > 0 && <p>{relativeTimeString(new Date(game.time))}</p>}
      </div>
    );
  }

  return null;
};

export function ProgressBar({ progress }: { progress: number }) {
  const percentage = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-primary-text">Progress</span>
        <span className="text-sm text-primary-text">{percentage}%</span>
      </div>
      <div className="w-full ring-1 ring-secondary-background rounded-lg h-10">
        <Shimmer duration={1200} intensity="light" className="rounded-lg">
          <div className="w-full">
            <div
              className="h-10 rounded-lg transition-all duration-1000 ease-out bg-secondary-background"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </Shimmer>
      </div>
    </div>
  );
}
