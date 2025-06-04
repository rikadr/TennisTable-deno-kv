import { EventType } from "../event-store/event-types";
import { TennisTable } from "../tennis-table";

export type WorkerMessage =
  | { type: "start-simulating-elo-over-time"; data: { playerId: string; events: EventType[] } }
  | { type: "simulated-elo-delivery"; data: { elements: { elo: number; time: number }[]; progress: number } }
  | { type: "done-with-simulation" };

// eslint-disable-next-line no-restricted-globals
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener("message", (event) => {
  handleWorkerMessage(event.data as WorkerMessage);
});

function handleWorkerMessage(message: WorkerMessage) {
  switch (message.type) {
    case "start-simulating-elo-over-time":
      const tennisTable = new TennisTable({ events: message.data.events });
      tennisTable.simulations.expectedPlayerEloOverTime(message.data.playerId, (data) =>
        postWorkerMessage({ type: "simulated-elo-delivery", data }),
      );
      postWorkerMessage({ type: "done-with-simulation" });
      break;
  }
}

function postWorkerMessage(message: WorkerMessage): void {
  scope.postMessage(message);
}
