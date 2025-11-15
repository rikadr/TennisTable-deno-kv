import { useEffect, useRef, useCallback, useState } from "react";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { TournamentPredictionResult } from "../client/client-db/tournaments/prediction";
import { createModernWorker } from "./use-elo-simulation-worker";

export function useTournamentPredictionWorker() {
  const context = useEventDbContext();

  const workerRef = useRef<Worker | null>(null);
  const [simulationIsDone, setSimulationIsDone] = useState(false);
  const [simulationTimes, setSimulationTimes] = useState<number[]>([]);
  const [predictionResults, setPredictionResults] = useState<TournamentPredictionResult[]>([]);
  const [simulationProgress, setSimulationProgress] = useState(0);

  // Initialize worker
  useEffect(() => {
    const worker = createModernWorker();
    workerRef.current = worker;

    if (worker) {
      worker.addEventListener("message", (e) => {
        const message = e.data as WorkerMessage;
        switch (message.type) {
          case "tournament-prediction-times":
            setSimulationTimes(message.data.times);
            setSimulationProgress(message.data.progress);
            break;

          case "tournament-prediction-data":
            setPredictionResults((prev) => [...prev, message.data.result]);
            setSimulationProgress(message.data.progress);
            break;

          case "tournament-prediction-complete":
            setSimulationIsDone(true);
            break;
        }
      });
    }

    // Cleanup on unmount
    return () => {
      worker?.terminate();
    };
  }, []);

  // Function to start simulation
  const startSimulation = useCallback(
    (tournamentId: string) => {
      // Reset state when starting new simulation
      setSimulationIsDone(false);
      setSimulationTimes([]);
      setPredictionResults([]);
      setSimulationProgress(0);

      if (workerRef.current) {
        const message: WorkerMessage = {
          type: "start-tournament-prediction",
          data: { tournamentId, events: context.events },
        };
        workerRef.current.postMessage(message);
      } else {
        console.error("Worker not initialized");
      }
    },
    [context.events],
  );

  return { startSimulation, simulationTimes, predictionResults, simulationIsDone, simulationProgress };
}
