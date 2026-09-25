import { useCallback, useEffect, useRef, useState } from "react";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { TournamentStagePredictionResult } from "../client/client-db/tournaments/stage-prediction";
import { createModernWorker } from "./use-elo-simulation-worker";

export function useTournamentStagePredictionWorker() {
  const context = useEventDbContext();

  const workerRef = useRef<Worker | null>(null);
  const [result, setResult] = useState<TournamentStagePredictionResult>();
  const [isRunning, setIsRunning] = useState(false);
  const [numSimulations, setNumSimulations] = useState(0);

  useEffect(() => {
    const worker = createModernWorker();
    workerRef.current = worker;

    worker?.addEventListener("message", (e) => {
      const message = e.data as WorkerMessage;
      if (message.type !== "tournament-stage-prediction-data") return;
      setResult(message.data.result);
      if (message.data.done) setIsRunning(false);
    });

    return () => {
      worker?.terminate();
    };
  }, []);

  const startSimulation = useCallback(
    (tournamentId: string, simulations: number) => {
      if (!workerRef.current) {
        console.error("Worker not initialized");
        return;
      }
      setResult(undefined);
      setIsRunning(true);
      setNumSimulations(simulations);
      const message: WorkerMessage = {
        type: "start-tournament-stage-prediction",
        data: { tournamentId, events: context.events, numSimulations: simulations },
      };
      workerRef.current.postMessage(message);
    },
    [context.events],
  );

  return { startSimulation, result, isRunning, numSimulations };
}
