import { EventType } from "../event-store/event-types";
import { PredictionHistoryEntry } from "../predictions-history";
import { ExpectedLeaderboard } from "../simulations";
import { TennisTable } from "../tennis-table";
import { TournamentPredictionResult } from "../tournaments/prediction";

export type WorkerMessage =
  | { type: "start-expected-leaderboard"; data: { events: EventType[] } }
  | { type: "expected-leaderboard-progress"; data: { progress: number } }
  | { type: "expected-leaderboard-result"; data: { result: ExpectedLeaderboard } }
  | { type: "start-simulating-elo-over-time"; data: { playerId: string; events: EventType[] } }
  | { type: "simulated-elo-delivery"; data: { elements: { elo: number; time: number }[]; progress: number } }
  | { type: "done-with-simulation" }
  | {
      type: "start-tournament-prediction";
      data: { tournamentId: string; events: EventType[]; numSimulations?: number };
    }
  | { type: "tournament-prediction-times"; data: { times: number[]; progress: number } }
  | { type: "tournament-prediction-data"; data: { result: TournamentPredictionResult; progress: number } }
  | { type: "tournament-prediction-complete" }
  | { type: "start-predictions-history"; data: { playerId: string; events: EventType[] } }
  | { type: "predictions-history-times"; data: { times: number[] } }
  | { type: "predictions-history-data"; data: { entry: PredictionHistoryEntry; progress: number } }
  | { type: "predictions-history-complete" };

// eslint-disable-next-line no-restricted-globals
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener("message", (event) => {
  handleWorkerMessage(event.data as WorkerMessage);
});

function handleWorkerMessage(message: WorkerMessage) {
  switch (message.type) {
    case "start-expected-leaderboard": {
      const tennisTableForLeaderboard = new TennisTable({ events: message.data.events });
      const result = tennisTableForLeaderboard.simulations.expectedLeaderBoard((progress) =>
        postWorkerMessage({ type: "expected-leaderboard-progress", data: { progress } }),
      );
      postWorkerMessage({ type: "expected-leaderboard-result", data: { result } });
      break;
    }

    case "start-simulating-elo-over-time":
      const tennisTable = new TennisTable({ events: message.data.events });
      tennisTable.simulations.expectedPlayerEloOverTime(message.data.playerId, (data) =>
        postWorkerMessage({ type: "simulated-elo-delivery", data }),
      );
      setTimeout(() => postWorkerMessage({ type: "done-with-simulation" }), 1000);
      break;

    case "start-tournament-prediction":
      const tennisTableForTournament = new TennisTable({ events: message.data.events });
      tennisTableForTournament.tournaments.tournamentPrediction.predictTournament(
        message.data.tournamentId,
        (data) => {
          if (data.simulationTimes) {
            postWorkerMessage({
              type: "tournament-prediction-times",
              data: { times: data.simulationTimes, progress: data.progress },
            });
          } else if (data.data) {
            postWorkerMessage({
              type: "tournament-prediction-data",
              data: { result: data.data, progress: data.progress },
            });
          }
        },
        message.data.numSimulations,
      );
      setTimeout(() => postWorkerMessage({ type: "tournament-prediction-complete" }), 1000);
      break;

    case "start-predictions-history":
      const tennisTableForHistory = new TennisTable({ events: message.data.events });
      tennisTableForHistory.predictionsHistory.computeHistoryForPlayer(
        message.data.playerId,
        (data) => postWorkerMessage({ type: "predictions-history-data", data }),
        (times) => postWorkerMessage({ type: "predictions-history-times", data: { times } }),
      );
      setTimeout(() => postWorkerMessage({ type: "predictions-history-complete" }), 1000);
      break;
  }
}

function postWorkerMessage(message: WorkerMessage): void {
  scope.postMessage(message);
}
