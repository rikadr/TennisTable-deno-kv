import { useEffect, useMemo, useState } from "react";
import {
  ExpectedScoreChange,
  expectedScoreChangeAroundGame,
  HallOfFameChange,
  hallOfFameChangeAroundGame,
  statesAroundGame,
} from "../client/client-db/game-standings";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { createModernWorker } from "./create-modern-worker";

type ScoreChange = { playerId: string; before: number | undefined; after: number | undefined };

export type ScoreChanges = {
  /** The score before and after the game, by player id. Empty while pending. */
  byPlayer: Map<string, ScoreChange>;
  pending: boolean;
};

type Result<Change> = { playedAt: number; changes: Change[] } | undefined;

function toScoreChanges(result: Result<ScoreChange>, playedAt: number | undefined): ScoreChanges {
  const matches = result !== undefined && result.playedAt === playedAt;
  return {
    byPlayer: new Map(matches ? result.changes.map((change) => [change.playerId, change]) : []),
    pending: !matches,
  };
}

/**
 * The expected score and the Hall of Fame score of the given players just
 * before and just after a game. Both need the full app state at the 2 times,
 * and the Hall of Fame score takes seconds on a long history. One web worker
 * builds the 2 states and calculates both scores, so the page renders without
 * waiting. The expected scores arrive first.
 */
export function useGameScoreChanges(
  playedAt: number | undefined,
  playerIds: string[],
): { expectedScore: ScoreChanges; hallOfFame: ScoreChanges } {
  const { events } = useEventDbContext();
  const [expectedScore, setExpectedScore] = useState<Result<ExpectedScoreChange>>(undefined);
  const [hallOfFame, setHallOfFame] = useState<Result<HallOfFameChange>>(undefined);

  // The player list is rebuilt on every render, so the effect depends on its
  // contents instead of its identity.
  const players = playerIds.join(",");

  useEffect(() => {
    if (playedAt === undefined) return;
    const ids = players.split(",");

    const worker = createModernWorker();
    if (!worker) {
      // Fallback: calculate on the main thread when workers are unavailable.
      const states = statesAroundGame(events, playedAt);
      setExpectedScore({ playedAt, changes: expectedScoreChangeAroundGame(states, ids) });
      setHallOfFame({ playedAt, changes: hallOfFameChangeAroundGame(states, ids) });
      return;
    }

    worker.addEventListener("message", (e) => {
      const message = e.data as WorkerMessage;
      if (message.type === "game-expected-score-change-result") setExpectedScore(message.data);
      if (message.type === "game-hall-of-fame-change-result") setHallOfFame(message.data);
    });
    const message: WorkerMessage = {
      type: "start-game-score-changes",
      data: { events, playedAt, playerIds: ids },
    };
    worker.postMessage(message);

    return () => worker.terminate();
  }, [events, playedAt, players]);

  return useMemo(
    () => ({
      expectedScore: toScoreChanges(expectedScore, playedAt),
      hallOfFame: toScoreChanges(hallOfFame, playedAt),
    }),
    [expectedScore, hallOfFame, playedAt],
  );
}
