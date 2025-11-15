import { useEffect, useRef, useCallback, useState } from "react";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";

export const createModernWorker = () => {
  try {
    const worker = new Worker(new URL("../client/client-db/web-worker/web-worker.ts", import.meta.url), {
      type: "module",
    });
    return worker;
  } catch (error) {
    console.log("Modern syntax not supported:", error);
    return null;
  }
};

export function useEloSimulationWorker() {
  const context = useEventDbContext();

  const workerRef = useRef<Worker | null>(null);
  const [simulationIsDone, setSimulationIsDone] = useState(false);
  const [simulatedElos, setSimulatedElos] = useState<{ elo: number; time: number }[]>([]);
  const [simulationProgress, setSimulationProgress] = useState(0);

  // Initialize worker
  useEffect(() => {
    const worker = createModernWorker();
    workerRef.current = worker;

    if (worker) {
      worker.addEventListener("message", (e) => {
        const message = e.data as WorkerMessage;
        switch (message.type) {
          case "simulated-elo-delivery":
            setSimulatedElos((prev) => [...prev, ...message.data.elements]);
            setSimulationProgress(message.data.progress);
            break;

          case "done-with-simulation":
            setSimulationIsDone(true);
            break;
        }
      });
    }

    // Cleanup on unmount
    return () => {
      worker?.terminate();
    };
  }, [setSimulatedElos, setSimulationProgress, setSimulationIsDone]);

  // Function to start simulation
  const startSimulation = useCallback((playerId: string) => {
    if (workerRef.current) {
      const message: WorkerMessage = {
        type: "start-simulating-elo-over-time",
        data: { playerId, events: context.events },
      };
      workerRef.current.postMessage(message);
    } else {
      console.error("Worker not initialized");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { startSimulation, simulatedElos, simulationIsDone, simulationProgress };
}
