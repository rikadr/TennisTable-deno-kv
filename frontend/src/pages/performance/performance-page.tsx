import React, { useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { TennisTable } from "../../client/client-db/tennis-table";
import { EventType } from "../../client/client-db/event-store/event-types";
import { fmtNum } from "../../common/number-utils";
import { classNames } from "../../common/class-names";

type BenchmarkOutcome = { ms: number; detail: string };

type Benchmark = {
  id: string;
  name: string;
  description: string;
  run: (events: EventType[]) => BenchmarkOutcome;
};

function timed(work: () => string): BenchmarkOutcome {
  const start = performance.now();
  const detail = work();
  return { ms: performance.now() - start, detail };
}

const benchmarks: Benchmark[] = [
  {
    id: "event-projection",
    name: "Event projection",
    description: "Create a TennisTable instance and project all events into players, games and tournaments.",
    run: (events) =>
      timed(() => {
        const tennisTable = new TennisTable({ events });
        return `${fmtNum(tennisTable.allPlayers.length)} players, ${fmtNum(tennisTable.games.length)} games`;
      }),
  },
  {
    id: "leaderboard",
    name: "Leaderboard",
    description: "Calculate elo for every game and build the full leaderboard.",
    run: (events) => {
      const tennisTable = new TennisTable({ events });
      return timed(() => {
        const leaderboard = tennisTable.leaderboard.getLeaderboard();
        return `${fmtNum(leaderboard.rankedPlayers.length)} ranked, ${fmtNum(
          leaderboard.unrankedPlayers.length,
        )} unranked players`;
      });
    },
  },
  {
    id: "leaderboard-changes",
    name: "Leaderboard changes",
    description: "Calculate the recent rank and elo changes for all players.",
    run: (events) => {
      const tennisTable = new TennisTable({ events });
      return timed(() => {
        const changes = tennisTable.leaderboardChanges.leaderboardChanges();
        return `${fmtNum(changes.length)} players with changes`;
      });
    },
  },
  {
    id: "achievements",
    name: "Achievements",
    description: "Calculate all achievements for all players.",
    run: (events) => {
      const tennisTable = new TennisTable({ events });
      return timed(() => {
        tennisTable.achievements.calculateAchievements();
        let total = 0;
        tennisTable.achievements.achievementMap.forEach((list) => (total += list.length));
        return `${fmtNum(total)} achievements for ${fmtNum(tennisTable.achievements.achievementMap.size)} players`;
      });
    },
  },
  {
    id: "seasons",
    name: "Seasons",
    description: "Build all seasons and calculate the leaderboard for each season.",
    run: (events) => {
      const tennisTable = new TennisTable({ events });
      return timed(() => {
        const seasons = tennisTable.seasons.getSeasons();
        seasons.forEach((season) => season.getLeaderboard());
        return `${fmtNum(seasons.length)} seasons`;
      });
    },
  },
  {
    id: "tournaments",
    name: "Tournaments",
    description: "Build all tournaments, including group play and brackets.",
    run: (events) => {
      const tennisTable = new TennisTable({ events });
      return timed(() => {
        const tournaments = tennisTable.tournaments.getTournaments();
        return `${fmtNum(tournaments.length)} tournaments`;
      });
    },
  },
  {
    id: "predictions",
    name: "Predictions mapping",
    description: "Build the pairwise stats and adjacency map, then predict the win fraction for every player pair.",
    run: (events) => {
      const tennisTable = new TennisTable({ events });
      return timed(() => {
        const playerIds = tennisTable.predictions.getAllPlayerIds();
        let pairs = 0;
        for (let i = 0; i < playerIds.length; i++) {
          for (let j = i + 1; j < playerIds.length; j++) {
            tennisTable.predictions.getPredictedFraction(playerIds[i], playerIds[j]);
            pairs++;
          }
        }
        return `${fmtNum(playerIds.length)} players, ${fmtNum(pairs)} pairs`;
      });
    },
  },
  {
    id: "hall-of-fame",
    name: "Hall of Fame",
    description: "Calculate the Hall of Fame. This includes the achievements and seasons calculations.",
    run: (events) => {
      const tennisTable = new TennisTable({ events });
      return timed(() => {
        const entries = tennisTable.hallOfFame.getHallOfFame();
        return `${fmtNum(entries.length)} entries`;
      });
    },
  },
  {
    id: "individual-points",
    name: "Individual points",
    description: "Calculate the individual point transactions for all players.",
    run: (events) => {
      const tennisTable = new TennisTable({ events });
      return timed(() => {
        const playerMap = tennisTable.individualPoints.playerMap();
        return `${fmtNum(playerMap.size)} players`;
      });
    },
  },
  {
    id: "player-pairings",
    name: "Player pairings",
    description: "Calculate the pairing network for every active player.",
    run: (events) => {
      const tennisTable = new TennisTable({ events });
      return timed(() => {
        tennisTable.players.forEach((player) => tennisTable.playerPairings.get(player.id));
        return `${fmtNum(tennisTable.players.length)} players`;
      });
    },
  },
  {
    id: "opponent-distribution",
    name: "Opponent distribution",
    description: "Calculate the opponent distribution for every active player.",
    run: (events) => {
      const tennisTable = new TennisTable({ events });
      return timed(() => {
        tennisTable.players.forEach((player) => tennisTable.playerOponentDistribution.get(player.id));
        return `${fmtNum(tennisTable.players.length)} players`;
      });
    },
  },
  {
    id: "pvp",
    name: "PvP comparisons",
    description: "Compare every pair of active players head to head.",
    run: (events) => {
      const tennisTable = new TennisTable({ events });
      return timed(() => {
        const players = tennisTable.players;
        let pairs = 0;
        for (let i = 0; i < players.length; i++) {
          for (let j = i + 1; j < players.length; j++) {
            tennisTable.pvp.compare(players[i].id, players[j].id);
            pairs++;
          }
        }
        return `${fmtNum(players.length)} players, ${fmtNum(pairs)} pairs`;
      });
    },
  },
];

type BenchmarkState =
  | { status: "running" }
  | { status: "done"; ms: number; detail: string }
  | { status: "error"; message: string };

function collectDatasetMetrics(context: TennisTable) {
  const games = context.games;
  const eventsByType: Record<string, number> = {};
  for (const event of context.events) {
    eventsByType[event.type] = (eventsByType[event.type] ?? 0) + 1;
  }

  const firstGame = games[0];
  const lastGame = games[games.length - 1];
  const dayMs = 1_000 * 60 * 60 * 24;

  const activePlayers = context.players.length;
  const totalPlayers = context.allPlayers.length;

  return {
    events: { total: context.events.length, byType: eventsByType },
    games: {
      total: games.length,
      withScore: games.filter((game) => game.score !== undefined).length,
      withSetPoints: games.filter((game) => game.score?.setPoints !== undefined).length,
      firstGameAt: firstGame ? new Date(firstGame.playedAt).toISOString() : null,
      lastGameAt: lastGame ? new Date(lastGame.playedAt).toISOString() : null,
      daysSinceFirstGame: firstGame ? Math.round(((Date.now() - firstGame.playedAt) / dayMs) * 10) / 10 : null,
    },
    players: {
      total: totalPlayers,
      active: activePlayers,
      inactive: totalPlayers - activePlayers,
      averageGamesPerActivePlayer: activePlayers > 0 ? Math.round(((games.length * 2) / activePlayers) * 10) / 10 : null,
    },
    tournaments: { total: context.tournaments.getTournaments().length },
    seasons: { total: context.seasons.getSeasons().length },
    gameLimitForRanked: context.client.gameLimitForRanked,
  };
}

export const PerformancePage: React.FC = () => {
  const context = useEventDbContext();
  const [results, setResults] = useState<Record<string, BenchmarkState>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const completedCount = benchmarks.filter((benchmark) => results[benchmark.id]?.status === "done").length;
  const totalMs = benchmarks.reduce((sum, benchmark) => {
    const result = results[benchmark.id];
    return result?.status === "done" ? sum + result.ms : sum;
  }, 0);

  async function copyResultsAsJson() {
    const exportData = {
      exportedAt: new Date().toISOString(),
      client: { id: context.client.id ?? null, name: context.client.name },
      environment: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      },
      datasetMetrics: collectDatasetMetrics(context),
      totalMs: Math.round(totalMs * 10) / 10,
      performanceResults: benchmarks.flatMap((benchmark) => {
        const result = results[benchmark.id];
        if (result?.status !== "done") return [];
        return [{ id: benchmark.id, name: benchmark.name, ms: Math.round(result.ms * 10) / 10, detail: result.detail }];
      }),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), 2_000);
  }

  async function runBenchmarks(benchmarksToRun: Benchmark[]) {
    if (isRunning) return;
    setIsRunning(true);
    const events = context.events;
    for (const benchmark of benchmarksToRun) {
      setResults((previous) => ({ ...previous, [benchmark.id]: { status: "running" } }));
      // Yield to the event loop so React paints the "running" state before the benchmark blocks the main thread
      await new Promise((resolve) => setTimeout(resolve, 50));
      try {
        const { ms, detail } = benchmark.run(events);
        setResults((previous) => ({ ...previous, [benchmark.id]: { status: "done", ms, detail } }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setResults((previous) => ({ ...previous, [benchmark.id]: { status: "error", message } }));
      }
    }
    setIsRunning(false);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-primary-background text-primary-text rounded-lg shadow-lg">
        <div className="p-6 border-b border-primary-text/10">
          <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-4">
            <h1 className="text-2xl">Performance testing ⏱️</h1>
            <div className="flex gap-2 shrink-0">
              <button
                className={classNames(
                  "bg-secondary-background text-secondary-text rounded-md px-4 py-2 text-lg",
                  isRunning ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary-background/50",
                )}
                disabled={isRunning}
                onClick={() => runBenchmarks(benchmarks)}
              >
                {isRunning ? "Running…" : "Run all"}
              </button>
              <button
                className={classNames(
                  "bg-secondary-background text-secondary-text rounded-md px-4 py-2 text-lg",
                  isRunning || completedCount === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary-background/50",
                )}
                disabled={isRunning || completedCount === 0}
                onClick={copyResultsAsJson}
              >
                {copyState === "copied" ? "Copied ✅" : copyState === "failed" ? "Copy failed ❌" : "Copy JSON 📋"}
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl tabular-nums">
              {completedCount > 0 ? `${fmtNum(totalMs, { digits: 1 })} ms` : "– ms"}
            </span>
            <span className="text-sm text-primary-text/70">
              total time for {completedCount} of {benchmarks.length} tests
            </span>
          </div>
          <p className="mt-4 text-sm text-primary-text/70">
            Each test creates a fresh TennisTable instance from the current {fmtNum(context.events.length)} events,
            without caches. The timer measures only the feature calculation, not the instance creation. Tests run on
            the main thread, so the page can freeze while a test runs.
          </p>
          <p className="mt-2 text-sm text-primary-text/70">
            Copy JSON copies the completed results together with dataset metrics: event, game, player, tournament and
            season counts, and the age of the game history. Collect the JSON from each client to compare how the times
            scale with the data.
          </p>
        </div>
        <div className="divide-y divide-primary-text/10">
          {benchmarks.map((benchmark) => {
            const result = results[benchmark.id];
            return (
              <div key={benchmark.id} className="p-4 xs:p-6 flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-4">
                <div className="grow">
                  <h2 className="text-lg">{benchmark.name}</h2>
                  <p className="text-sm text-primary-text/70">{benchmark.description}</p>
                  <p className={classNames("text-sm", result?.status === "error" ? "text-red-500" : "text-primary-text/70")}>
                    {result?.status === "done" && result.detail}
                    {result?.status === "error" && `Failed: ${result.message}`}
                    {(result === undefined || result.status === "running") && " "}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right min-w-24 text-lg tabular-nums">
                    {result === undefined && <span className="text-primary-text/40">–</span>}
                    {result?.status === "running" && <span className="animate-pulse">Running…</span>}
                    {result?.status === "done" && <span>{fmtNum(result.ms, { digits: 1 })} ms</span>}
                    {result?.status === "error" && <span className="text-red-500">Error</span>}
                  </div>
                  <button
                    className={classNames(
                      "bg-secondary-background text-secondary-text rounded-md px-4 py-2",
                      isRunning ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary-background/50",
                    )}
                    disabled={isRunning}
                    onClick={() => runBenchmarks([benchmark])}
                  >
                    Run
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
