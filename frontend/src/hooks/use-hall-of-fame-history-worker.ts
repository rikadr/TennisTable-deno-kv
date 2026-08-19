import { useCallback, useEffect, useRef, useState } from "react";
import { HallOfFameHistoryResult } from "../client/client-db/hall-of-fame-history";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { createModernWorker } from "./use-elo-simulation-worker";

/** Simulates a player's Hall of Fame score over time in a web worker.
 * The result arrives in one piece when every point is done. `progress` tracks
 * how far the simulation has come. */
export function useHallOfFameHistoryWorker() {
  const context = useEventDbContext();

  const workerRef = useRef<Worker | null>(null);
  const [result, setResult] = useState<HallOfFameHistoryResult | undefined>(undefined);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  // The events are read through a ref so `startComputation` stays stable. The
  // query refetches on window focus and returns a new array every time, so a
  // dependency on the events themselves would terminate the worker and restart
  // the simulation from 0% every time the tab regains focus.
  const eventsRef = useRef(context.events);
  eventsRef.current = context.events;

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const startComputation = useCallback(
    (playerId: string) => {
      workerRef.current?.terminate();

      setResult(undefined);
      setProgress(0);
      setFailed(false);

      const worker = createModernWorker();
      workerRef.current = worker;

      if (!worker) {
        console.error("Worker not initialized");
        setFailed(true);
        return;
      }

      worker.addEventListener("message", (e) => {
        const message = e.data as WorkerMessage;
        switch (message.type) {
          case "hall-of-fame-history-progress":
            setProgress(message.data.progress);
            break;
          case "hall-of-fame-history-result":
            setResult(message.data.result);
            setProgress(1);
            break;
        }
      });

      // Without these the graph waits on a progress bar forever if the
      // simulation throws or runs out of memory part way through.
      const fail = (error: unknown) => {
        console.error("Hall of fame history simulation failed", error);
        setFailed(true);
      };
      worker.addEventListener("error", fail);
      worker.addEventListener("messageerror", fail);

      const message: WorkerMessage = {
        type: "start-hall-of-fame-history",
        data: { playerId, events: eventsRef.current, now: Date.now() },
      };
      worker.postMessage(message);
    },
    [],
  );

  return { startComputation, result, progress, failed, isDone: result !== undefined };
}
