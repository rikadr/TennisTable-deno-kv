import { useEffect, useState } from "react";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { PredictionHistoryEntry } from "../client/client-db/predictions-history";
import { createModernWorker } from "./create-modern-worker";

/** The prediction history of the player, calculated in a web worker. Undefined until the result is ready */
export function usePredictionsHistoryWorker(playerId: string) {
  const context = useEventDbContext();
  const [result, setResult] = useState<{ playerId: string; entries: PredictionHistoryEntry[] }>();

  useEffect(() => {
    const worker = createModernWorker();
    if (!worker) {
      // Fallback: run on the main thread if workers are unavailable
      setResult({ playerId, entries: context.predictionsHistory.computeHistoryForPlayer(playerId) });
      return;
    }

    worker.addEventListener("message", (e) => {
      const message = e.data as WorkerMessage;
      if (message.type === "predictions-history-result") {
        setResult({ playerId, entries: message.data.entries });
        worker.terminate();
      }
    });
    const message: WorkerMessage = { type: "start-predictions-history", data: { playerId, events: context.events } };
    worker.postMessage(message);
    return () => worker.terminate();
    // The context changes also when only the achievements change. The history needs only the events
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.events, playerId]);

  // A result for the player before stays hidden until the result for this player is ready
  return result?.playerId === playerId ? result.entries : undefined;
}
