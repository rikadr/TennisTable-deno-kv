import { useCallback, useEffect, useRef, useState } from "react";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { ExpectedLeaderboard } from "../client/client-db/simulations";
import { createModernWorker } from "./use-elo-simulation-worker";

/**
 * Expected-leaderboard simulation that also includes one unranked player, so
 * their expected score can be shown on the player page. Unlike
 * useExpectedLeaderboardWorker it does not start on mount — call start().
 */
export function useUnrankedExpectedScoreWorker(playerId: string) {
  const context = useEventDbContext();

  const workerRef = useRef<Worker | null>(null);
  const [result, setResult] = useState<ExpectedLeaderboard | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const start = useCallback(() => {
    if (running || result) return;
    setRunning(true);

    const worker = createModernWorker();

    if (!worker) {
      // Fallback: run on the main thread if workers are unavailable
      setResult(context.simulations.expectedLeaderBoard(undefined, playerId));
      setProgress(1);
      setRunning(false);
      return;
    }
    workerRef.current = worker;

    worker.addEventListener("message", (e) => {
      const message = e.data as WorkerMessage;
      switch (message.type) {
        case "expected-leaderboard-progress":
          setProgress(message.data.progress);
          break;

        case "expected-leaderboard-result":
          setProgress(1);
          setResult(message.data.result);
          setRunning(false);
          break;
      }
    });

    const message: WorkerMessage = {
      type: "start-expected-leaderboard",
      data: { events: context.events, includeUnrankedPlayerId: playerId },
    };
    worker.postMessage(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, running, result]);

  return { start, result, progress, running };
}
