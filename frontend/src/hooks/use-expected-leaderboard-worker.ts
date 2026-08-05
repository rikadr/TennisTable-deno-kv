import { useEffect, useState } from "react";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { ExpectedLeaderboard } from "../client/client-db/simulations";
import { createModernWorker } from "./use-elo-simulation-worker";

export function useExpectedLeaderboardWorker() {
  const context = useEventDbContext();

  const [result, setResult] = useState<ExpectedLeaderboard | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const worker = createModernWorker();

    if (!worker) {
      // Fallback: run on the main thread if workers are unavailable
      setResult(context.simulations.expectedLeaderBoard());
      setProgress(1);
      return;
    }

    worker.addEventListener("message", (e) => {
      const message = e.data as WorkerMessage;
      switch (message.type) {
        case "expected-leaderboard-progress":
          setProgress(message.data.progress);
          break;

        case "expected-leaderboard-result":
          setProgress(1);
          setResult(message.data.result);
          break;
      }
    });

    const message: WorkerMessage = { type: "start-expected-leaderboard", data: { events: context.events } };
    worker.postMessage(message);

    return () => {
      worker.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { result, progress };
}
