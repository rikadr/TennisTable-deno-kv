import { useEffect, useState } from "react";
import { AchievementsSnapshot } from "../client/client-db/achievements";
import { EventType } from "../client/client-db/event-store/event-types";
import { TennisTable } from "../client/client-db/tennis-table";
import { WorkerMessage } from "../client/client-db/web-worker/web-worker";
import { createModernWorker } from "./create-modern-worker";

export type AchievementsSnapshotResult = {
  /** The latest snapshot. It can be from earlier events or another reference time while a new one is calculated */
  snapshot: AchievementsSnapshot | undefined;
  /** True when the snapshot is from these events and this reference time */
  isCurrent: boolean;
};

/**
 * The achievements of the events at the reference time. The calculation runs
 * in a web worker, so the page renders without waiting for it.
 */
export function useAchievementsSnapshot(
  events: EventType[] | undefined,
  referenceTime?: number,
): AchievementsSnapshotResult {
  const [result, setResult] = useState<{
    events: EventType[];
    referenceTime: number | undefined;
    snapshot: AchievementsSnapshot;
  }>();

  useEffect(() => {
    if (events === undefined) return;

    const worker = createModernWorker();
    if (!worker) {
      // Fallback: calculate on the main thread when workers are unavailable.
      setResult({
        events,
        referenceTime,
        snapshot: new TennisTable({ events, referenceTime }).achievements.toSnapshot(),
      });
      return;
    }

    worker.addEventListener("message", (e) => {
      const message = e.data as WorkerMessage;
      if (message.type === "achievements-result") {
        setResult({ events, referenceTime, snapshot: message.data.snapshot });
        worker.terminate();
      }
    });
    const message: WorkerMessage = { type: "start-achievements", data: { events, referenceTime } };
    worker.postMessage(message);

    return () => worker.terminate();
  }, [events, referenceTime]);

  return {
    snapshot: result?.snapshot,
    isCurrent: result !== undefined && result.events === events && result.referenceTime === referenceTime,
  };
}
