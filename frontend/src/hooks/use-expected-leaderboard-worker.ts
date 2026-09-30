import { useEffect, useState } from "react";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { ExpectedLeaderboard } from "../client/client-db/simulations";
import { createModernWorker } from "./use-elo-simulation-worker";

export function useExpectedLeaderboardWorker() {
  const context = useEventDbContext();

  const [result, setResult] = useState<ExpectedLeaderboard | null>(null);

  useEffect(() => {
    const worker = createModernWorker();

    if (!worker) {
      // Fallback: run on the main thread if workers are unavailable
      setResult(context.simulations.expectedLeaderBoard());
      return;
    }

    worker.addEventListener("message", (e) => {
      const message = e.data as WorkerMessage;
      if (message.type === "expected-leaderboard-result") setResult(message.data.result);
    });

    const message: WorkerMessage = { type: "start-expected-leaderboard", data: { events: context.events } };
    worker.postMessage(message);

    return () => {
      worker.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { result };
}
