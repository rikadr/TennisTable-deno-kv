import { useEffect, useMemo, useState } from "react";
import { ExpectedScoreChange, expectedScoreChangeAroundGame } from "../client/client-db/game-standings";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { createModernWorker } from "./create-modern-worker";

export type ExpectedScoreChanges = {
  /** The score before and after the game, by player id. Empty while pending. */
  byPlayer: Map<string, ExpectedScoreChange>;
  pending: boolean;
};

/**
 * The expected score of the given players just before and just after a game.
 * The calculation needs an expected leaderboard at each of the 2 times, so it
 * runs in a web worker and the page renders without waiting for it.
 */
export function useGameExpectedScoreChange(playedAt: number | undefined, playerIds: string[]): ExpectedScoreChanges {
  const { events } = useEventDbContext();
  const [result, setResult] = useState<{ playedAt: number; changes: ExpectedScoreChange[] } | undefined>(undefined);

  // The player list is rebuilt on every render, so the effect depends on its
  // contents instead of its identity.
  const players = playerIds.join(",");

  useEffect(() => {
    if (playedAt === undefined) return;
    const ids = players.split(",");

    const worker = createModernWorker();
    if (!worker) {
      // Fallback: calculate on the main thread when workers are unavailable.
      setResult({ playedAt, changes: expectedScoreChangeAroundGame(events, playedAt, ids) });
      return;
    }

    worker.addEventListener("message", (e) => {
      const message = e.data as WorkerMessage;
      if (message.type === "game-expected-score-change-result") {
        setResult({ playedAt: message.data.playedAt, changes: message.data.changes });
      }
    });
    const message: WorkerMessage = {
      type: "start-game-expected-score-change",
      data: { events, playedAt, playerIds: ids },
    };
    worker.postMessage(message);

    return () => worker.terminate();
  }, [events, playedAt, players]);

  return useMemo(() => {
    const matches = result !== undefined && result.playedAt === playedAt;
    return {
      byPlayer: new Map(matches ? result.changes.map((change) => [change.playerId, change]) : []),
      pending: !matches,
    };
  }, [result, playedAt]);
}
