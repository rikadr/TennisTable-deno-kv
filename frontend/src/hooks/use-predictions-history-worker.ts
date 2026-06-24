import { useRef, useCallback, useState, useMemo, useEffect } from "react";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { PredictionHistoryEntry } from "../client/client-db/predictions-history";
import { createModernWorker } from "./use-elo-simulation-worker";

export function usePredictionsHistoryWorker() {
  const context = useEventDbContext();

  const workerRef = useRef<Worker | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [history, setHistory] = useState<PredictionHistoryEntry[]>([]);
  const [times, setTimes] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const startComputation = useCallback(
    (playerId: string) => {
      workerRef.current?.terminate();

      setIsDone(false);
      setHistory([]);
      setTimes([]);
      setProgress(0);

      const worker = createModernWorker();
      workerRef.current = worker;

      if (worker) {
        worker.addEventListener("message", (e) => {
          const message = e.data as WorkerMessage;
          switch (message.type) {
            case "predictions-history-times":
              setTimes(message.data.times);
              break;
            case "predictions-history-data":
              setHistory((prev) => [...prev, message.data.entry]);
              setProgress(message.data.progress);
              break;
            case "predictions-history-complete":
              setIsDone(true);
              break;
          }
        });

        const message: WorkerMessage = {
          type: "start-predictions-history",
          data: { playerId, events: context.events },
        };
        worker.postMessage(message);
      } else {
        console.error("Worker not initialized");
      }
    },
    [context.events],
  );

  const entryByTime = useMemo(() => {
    const map = new Map<number, PredictionHistoryEntry>();
    for (const entry of history) {
      map.set(entry.time, entry);
    }
    return map;
  }, [history]);

  return { startComputation, entryByTime, times, isDone, progress };
}
