import { EventType } from "../event-store/event-types";
import { HallOfFameHistoryResult } from "../hall-of-fame-history";
import { PredictionHistoryEntry } from "../predictions-history";
import { ExpectedLeaderboard } from "../simulations";
import { TennisTable } from "../tennis-table";
import { TournamentPredictionResult } from "../tournaments/prediction";
import { WhrConfig, WhrResult } from "../whr";

export type WorkerMessage =
  | {
      type: "start-expected-leaderboard";
      data: {
        events: EventType[];
        referenceTime?: number;
        includeUnrankedPlayerId?: string;
        simulations?: number;
      };
    }
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
  | { type: "predictions-history-complete" }
  | { type: "start-whr"; data: { events: EventType[]; config?: Partial<WhrConfig> } }
  | { type: "whr-progress"; data: { progress: number } }
  | { type: "whr-result"; data: { result: WhrResult } }
  | {
      type: "start-hall-of-fame-history";
      data: { playerId: string; events: EventType[]; now: number };
    }
  | { type: "hall-of-fame-history-progress"; data: { progress: number } }
  | { type: "hall-of-fame-history-result"; data: { result: HallOfFameHistoryResult } };

// eslint-disable-next-line no-restricted-globals
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener("message", (event) => {
  handleWorkerMessage(event.data as WorkerMessage);
});

function handleWorkerMessage(message: WorkerMessage) {
  switch (message.type) {
    case "start-expected-leaderboard": {
      const tennisTableForLeaderboard = new TennisTable({
        events: message.data.events,
        referenceTime: message.data.referenceTime,
      });
      const result = tennisTableForLeaderboard.simulations.expectedLeaderBoard(
        (progress) => postWorkerMessage({ type: "expected-leaderboard-progress", data: { progress } }),
        message.data.includeUnrankedPlayerId,
        message.data.simulations,
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

    case "start-hall-of-fame-history": {
      const tennisTableForHallOfFame = new TennisTable({ events: message.data.events });
      const result = tennisTableForHallOfFame.hallOfFameHistory.computeForPlayer(
        message.data.playerId,
        message.data.now,
        (progress) => postWorkerMessage({ type: "hall-of-fame-history-progress", data: { progress } }),
      );
      postWorkerMessage({ type: "hall-of-fame-history-result", data: { result } });
      break;
    }

    case "start-whr": {
      const tennisTableForWhr = new TennisTable({ events: message.data.events });
      const result = tennisTableForWhr.whr.compute(message.data.config, (progress) =>
        postWorkerMessage({ type: "whr-progress", data: { progress } }),
      );
      postWorkerMessage({ type: "whr-result", data: { result } });
      break;
    }
  }
}

function postWorkerMessage(message: WorkerMessage): void {
  scope.postMessage(message);
}
