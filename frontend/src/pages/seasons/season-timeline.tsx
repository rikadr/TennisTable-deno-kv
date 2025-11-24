import React, { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useWindowSize } from "usehooks-ts";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { Season } from "../../client/client-db/seasons/season";
import { stringToColor } from "../../common/string-to-color";
import { relativeTimeString } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";

type Props = {
  season: Season;
};

interface TimelineEntry {
  time: number;
  gameIndex: number;
  scores: Record<string, number>;
  improvements: {
    playerId: string;
    opponentId: string;
    previousBest: number;
    newBest: number;
    improvement: number;
  }[];
}

function calculateSeasonTimeline(season: Season): {
  timeline: TimelineEntry[];
  allPlayerIds: string[];
} {
  const playerMatchups = new Map<string, Map<string, number>>();
  const playerScores = new Map<string, number>();
  const timeline: TimelineEntry[] = [];
  const allPlayerIds = new Set<string>();

  const sortedGames = [...season.games].sort((a, b) => a.playedAt - b.playedAt);

  for (let i = 0; i < sortedGames.length; i++) {
    const game = sortedGames[i];
    const improvements: TimelineEntry["improvements"] = [];

    allPlayerIds.add(game.winner);
    allPlayerIds.add(game.loser);

    const winnerPerformance = calculatePerformance(game, true);
    const loserPerformance = calculatePerformance(game, false);

    const winnerImprovement = checkAndUpdateBest(
      playerMatchups,
      playerScores,
      game.winner,
      game.loser,
      winnerPerformance,
    );
    if (winnerImprovement) {
      improvements.push(winnerImprovement);
    }

    const loserImprovement = checkAndUpdateBest(
      playerMatchups,
      playerScores,
      game.loser,
      game.winner,
      loserPerformance,
    );
    if (loserImprovement) {
      improvements.push(loserImprovement);
    }

    if (improvements.length > 0) {
      timeline.push({
        time: game.playedAt,
        gameIndex: i,
        scores: Object.fromEntries(playerScores),
        improvements,
      });
    }
  }

  return { timeline, allPlayerIds: Array.from(allPlayerIds) };
}

function calculatePerformance(
  game: {
    score?: {
      setsWon?: { gameWinner: number; gameLoser: number };
      setPoints?: { gameWinner: number; gameLoser: number }[];
    };
  },
  isWinner: boolean,
): number {
  const winPerformance = isWinner ? 100 : 0;

  let setsPerformance = 0;
  if (game.score?.setsWon) {
    const setsWon = isWinner ? game.score.setsWon.gameWinner : game.score.setsWon.gameLoser;
    const totalSets = game.score.setsWon.gameWinner + game.score.setsWon.gameLoser;
    setsPerformance = (setsWon / totalSets) * 100;
  }

  let ballsPerformance = 0;
  if (game.score?.setPoints && game.score.setPoints.length > 0) {
    const { winnerBalls, loserBalls } = game.score.setPoints.reduce(
      (acc, set) => ({
        winnerBalls: acc.winnerBalls + set.gameWinner,
        loserBalls: acc.loserBalls + set.gameLoser,
      }),
      { winnerBalls: 0, loserBalls: 0 },
    );
    const playerBalls = isWinner ? winnerBalls : loserBalls;
    const totalBalls = winnerBalls + loserBalls;
    ballsPerformance = (playerBalls / totalBalls) * 100;
  }

  return (winPerformance + setsPerformance + ballsPerformance) / 3;
}

function checkAndUpdateBest(
  playerMatchups: Map<string, Map<string, number>>,
  playerScores: Map<string, number>,
  playerId: string,
  opponentId: string,
  performance: number,
): TimelineEntry["improvements"][number] | null {
  if (!playerMatchups.has(playerId)) {
    playerMatchups.set(playerId, new Map());
  }
  const matchups = playerMatchups.get(playerId)!;
  const previousBest = matchups.get(opponentId) ?? 0;

  if (performance > previousBest) {
    const improvement = performance - previousBest;
    matchups.set(opponentId, performance);

    const currentScore = playerScores.get(playerId) ?? 0;
    playerScores.set(playerId, currentScore + improvement);

    return {
      playerId,
      opponentId,
      previousBest,
      newBest: performance,
      improvement,
    };
  }

  return null;
}

export const SeasonTimeline = ({ season }: Props) => {
  const context = useEventDbContext();
  const { width = 0 } = useWindowSize();

  const { timeline, allPlayerIds } = useMemo(() => calculateSeasonTimeline(season), [season]);

  // Initialize with ALL players visible
  const [visiblePlayers, setVisiblePlayers] = useState<Set<string>>(() => new Set(allPlayerIds));

  const [startRange, setStartRange] = useState(0);
  const [endRange, setEndRange] = useState(0);
  const [tooltipEnabled, setTooltipEnabled] = useState(true);

  if (timeline.length === 0) {
    return <div className="text-primary-text/50 p-4">No games in this season yet.</div>;
  }

  const chartData = timeline.map((entry, idx) => ({
    ...entry,
    index: idx,
    label: relativeTimeString(new Date(entry.time)),
  }));

  const minimumEntriesOnScreen = Math.min(width, 1250) / 50;
  const slicedData = chartData.slice(startRange, chartData.length - endRange);

  const finalScores = timeline[timeline.length - 1]?.scores ?? {};
  const sortedPlayers = allPlayerIds
    .map((id) => ({ id, score: finalScores[id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const togglePlayer = (playerId: string) => {
    setVisiblePlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const handleChartClick = () => {
    setTooltipEnabled((prev) => !prev);
  };

  return (
    <div className="space-y-4 my-4">
      {/* Player Legend/Toggle */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            if (visiblePlayers.size === allPlayerIds.length) {
              setVisiblePlayers(new Set());
            } else {
              setVisiblePlayers(new Set(allPlayerIds));
            }
          }}
          className="px-2 py-1 text-sm rounded-lg transition-colors bg-secondary-background text-secondary-text hover:bg-secondary-background/80"
        >
          {visiblePlayers.size === allPlayerIds.length ? "Deselect All" : "Select All"}
        </button>
        {sortedPlayers.map(({ id, score }) => (
          <button
            key={id}
            onClick={() => togglePlayer(id)}
            className={`px-2 py-1 text-sm rounded-lg transition-opacity ${
              visiblePlayers.has(id) ? "opacity-100" : "opacity-40"
            }`}
            style={{
              backgroundColor: stringToColor(id),
              color: "white",
            }}
          >
            {context.playerName(id)} ({fmtNum(score, { digits: 0 })})
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={width > 768 ? 500 : 450}>
        <LineChart data={slicedData} margin={{ top: 5, right: 0, left: -12 }} onClick={handleChartClick}>
          <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="rgb(var(--color-primary-text))" opacity={0.3} />
          <YAxis
            type="number"
            domain={[0, "auto"]}
            tickFormatter={(value) => value.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
            stroke="rgb(var(--color-primary-text))"
          />
          <XAxis dataKey="index" stroke="rgb(var(--color-primary-text))" tickFormatter={(idx) => `#${idx + 1}`} />
          {tooltipEnabled && (
            <Tooltip
              content={<SeasonTooltip context={context} />}
              wrapperClassName="rounded-lg"
              animationDuration={0}
            />
          )}

          {allPlayerIds
            .filter((id) => visiblePlayers.has(id))
            .map((playerId) => (
              <Line
                key={playerId}
                type="monotone"
                dataKey={`scores.${playerId}`}
                stroke={stringToColor(playerId)}
                dot={false}
                animationDuration={100}
                strokeWidth={2}
                connectNulls
                name={context.playerName(playerId)}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Range Sliders */}
      {chartData.length > 20 && (
        <div className="flex items-center gap-4">
          <div className="w-full">
            <input
              className="w-full"
              type="range"
              min={0}
              max={chartData.length || 0}
              value={startRange}
              onChange={(e) => {
                const screenSizeLimited = Math.min(parseInt(e.target.value), chartData.length - minimumEntriesOnScreen);
                const rangeLimited = Math.min(screenSizeLimited, chartData.length - endRange - minimumEntriesOnScreen);
                setStartRange(rangeLimited);
              }}
            />
            <input
              className="w-full rotate-180"
              type="range"
              min={0}
              max={chartData.length || 0}
              value={endRange}
              onChange={(e) => {
                const screenSizeLimited = Math.min(parseInt(e.target.value), chartData.length - minimumEntriesOnScreen);
                const rangeLimited = Math.min(
                  screenSizeLimited,
                  chartData.length - startRange - minimumEntriesOnScreen,
                );
                setEndRange(rangeLimited);
              }}
            />
          </div>
          <button
            className={`px-2 py-1 whitespace-nowrap bg-secondary-background text-secondary-text hover:bg-secondary-background/50 rounded-lg ${
              startRange === 0 && endRange === 0 ? "opacity-0" : ""
            }`}
            disabled={startRange === 0 && endRange === 0}
            onClick={() => {
              setStartRange(0);
              setEndRange(0);
            }}
          >
            &#8634; Reset
          </button>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-primary-text">
        <div className="p-2 bg-secondary-background/30 rounded-lg">
          <p className="text-sm text-primary-text/70">Total Games</p>
          <p className="text-xl font-bold">{season.games.length}</p>
        </div>
        <div className="p-2 bg-secondary-background/30 rounded-lg">
          <p className="text-sm text-primary-text/70">Score Improvements</p>
          <p className="text-xl font-bold">{timeline.length}</p>
        </div>
        <div className="p-2 bg-secondary-background/30 rounded-lg">
          <p className="text-sm text-primary-text/70">Players</p>
          <p className="text-xl font-bold">{allPlayerIds.length}</p>
        </div>
      </div>
    </div>
  );
};

interface SeasonTooltipProps extends TooltipProps<ValueType, NameType> {
  context: ReturnType<typeof useEventDbContext>;
}

const SeasonTooltip: React.FC<SeasonTooltipProps> = ({ active, payload, context }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const entry = payload[0]?.payload as TimelineEntry & { label: string };
  if (!entry) return null;

  return (
    <div className="p-3 bg-primary-background ring-1 ring-primary-text rounded-lg text-primary-text max-w-xs">
      <p className="text-sm text-primary-text/70 mb-2">{entry.label}</p>

      {entry.improvements.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-primary-text/50">Score Improvements</p>
          {entry.improvements.map((imp, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm" style={{ color: stringToColor(imp.playerId) }}>
              <span className="font-medium">{context.playerName(imp.playerId)}</span>
              <span className="text-primary-text/70">vs</span>
              <span>{context.playerName(imp.opponentId)}</span>
              <span className="ml-auto font-bold text-green-400">+{fmtNum(imp.improvement, { digits: 1 })}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-primary-text/20">
        <p className="text-xs uppercase tracking-wide text-primary-text/50 mb-1">Current Scores</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {Object.entries(entry.scores)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([playerId, score]) => (
              <div key={playerId} className="flex justify-between">
                <span style={{ color: stringToColor(playerId) }}>{context.playerName(playerId)}</span>
                <span>{fmtNum(score, { digits: 0 })}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
