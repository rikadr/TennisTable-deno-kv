import { useEffect, useState } from "react";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { useEventDbContext } from "../wrappers/event-db-context";
import { WhrConfig, WhrResult } from "../client/client-db/whr";
import { createModernWorker } from "./use-elo-simulation-worker";

/**
 * Fits the Whole History Rating in a web worker. The fit restarts whenever the
 * configuration changes, so a new setting replaces the previous result.
 */
export function useWhrWorker(config?: Partial<WhrConfig>) {
  const context = useEventDbContext();

  const [result, setResult] = useState<WhrResult | null>(null);
  const [progress, setProgress] = useState(0);

  // A stable key over the settings, so the effect restarts on a real change only
  const configKey = JSON.stringify(config ?? {});

  useEffect(() => {
    const activeConfig = JSON.parse(configKey) as Partial<WhrConfig>;
    setResult(null);
    setProgress(0);

    const worker = createModernWorker();

    if (!worker) {
      // Fallback: run on the main thread if workers are unavailable
      setResult(context.whr.compute(activeConfig));
      setProgress(1);
      return;
    }

    worker.addEventListener("message", (e) => {
      const message = e.data as WorkerMessage;
      switch (message.type) {
        case "whr-progress":
          setProgress(message.data.progress);
          break;

        case "whr-result":
          setResult(message.data.result);
          setProgress(1);
          break;
      }
    });

    const message: WorkerMessage = {
      type: "start-whr",
      data: { events: context.events, config: activeConfig },
    };
    worker.postMessage(message);

    return () => {
      worker.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  return { result, progress };
}
