import { useEffect, useMemo, useState } from "react";
import { HallOfFameChange, hallOfFameChangeAroundGame } from "../client/client-db/game-standings";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { createModernWorker } from "./use-elo-simulation-worker";

export type HallOfFameChanges = {
  /** The score before and after the game, by player id. Empty while pending. */
  byPlayer: Map<string, HallOfFameChange>;
  pending: boolean;
};

/**
 * The Hall of Fame score of the given players just before and just after a
 * game. The calculation scores every achievement of every player twice, so it
 * runs in a web worker and the page renders without waiting for it.
 */
export function useGameHallOfFameChange(playedAt: number | undefined, playerIds: string[]): HallOfFameChanges {
  const context = useEventDbContext();
  const [result, setResult] = useState<{ playedAt: number; changes: HallOfFameChange[] } | undefined>(undefined);

  // The player list is rebuilt on every render, so the effect depends on its
  // contents instead of its identity.
  const players = playerIds.join(",");

  useEffect(() => {
    if (playedAt === undefined) return;
    const ids = players.split(",");

    const worker = createModernWorker();
    if (!worker) {
      // Fallback: calculate on the main thread when workers are unavailable.
      setResult({ playedAt, changes: hallOfFameChangeAroundGame(context.events, playedAt, ids) });
      return;
    }

    worker.addEventListener("message", (e) => {
      const message = e.data as WorkerMessage;
      if (message.type === "game-hall-of-fame-change-result") {
        setResult({ playedAt: message.data.playedAt, changes: message.data.changes });
      }
    });
    const message: WorkerMessage = {
      type: "start-game-hall-of-fame-change",
      data: { events: context.events, playedAt, playerIds: ids },
    };
    worker.postMessage(message);

    return () => worker.terminate();
  }, [context, playedAt, players]);

  return useMemo(() => {
    const matches = result !== undefined && result.playedAt === playedAt;
    return {
      byPlayer: new Map(matches ? result.changes.map((change) => [change.playerId, change]) : []),
      pending: !matches,
    };
  }, [result, playedAt]);
}
