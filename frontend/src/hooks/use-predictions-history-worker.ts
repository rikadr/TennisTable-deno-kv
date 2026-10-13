import { useEffect, useState } from "react";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { PredictionHistoryEntry } from "../client/client-db/predictions-history";
import { createModernWorker } from "./create-modern-worker";

export type PredictionsHistoryState = {
  /** All the times of the history, before their entries are ready */
  times: number[];
  entryByTime: ReadonlyMap<number, PredictionHistoryEntry>;
  isDone: boolean;
};

/**
 * The prediction history of the player, calculated in a web worker. The times come first, then the entries in
 * batches, so a chart can fill in progressively. Undefined until the times are ready.
 */
export function usePredictionsHistoryWorker(playerId: string): PredictionsHistoryState | undefined {
  const context = useEventDbContext();
  const [state, setState] = useState<PredictionsHistoryState & { playerId: string }>();

  useEffect(() => {
    const worker = createModernWorker();
    if (!worker) {
      // Fallback: run on the main thread if workers are unavailable
      const entries = context.predictionsHistory.computeHistoryForPlayer(playerId);
      setState({
        playerId,
        times: entries.map((entry) => entry.time),
        entryByTime: new Map(entries.map((entry) => [entry.time, entry])),
        isDone: true,
      });
      return;
    }

    worker.addEventListener("message", (e) => {
      const message = e.data as WorkerMessage;
      if (message.type === "predictions-history-times") {
        setState({ playerId, times: message.data.times, entryByTime: new Map(), isDone: false });
      } else if (message.type === "predictions-history-entries") {
        const { entries, done } = message.data;
        setState((prev) => {
          // A player with no games gets no times, only an empty last batch
          const base = prev?.playerId === playerId ? prev : { playerId, times: [], entryByTime: new Map() };
          const entryByTime = new Map(base.entryByTime);
          for (const entry of entries) entryByTime.set(entry.time, entry);
          return { ...base, entryByTime, isDone: done };
        });
        if (done) worker.terminate();
      }
    });
    const message: WorkerMessage = { type: "start-predictions-history", data: { playerId, events: context.events } };
    worker.postMessage(message);
    return () => worker.terminate();
    // The context changes also when only the achievements change. The history needs only the events
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.events, playerId]);

  // The state of the player before stays hidden until the times for this player are ready
  if (state?.playerId !== playerId) return undefined;
  return state;
}
