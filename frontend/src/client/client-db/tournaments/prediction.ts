import { EventTypeEnum } from "../event-store/event-types";
import { TennisTable } from "../tennis-table";
import { HYBRID_SAMPLE_DIVISOR, PredictionMethod, Tournament } from "./tournament";

export const NUM_SIMULATIONS = 5_000; // 10_000 at least. 1_000 for higher performance
const SIMULATION_TIME_BUFFER = 10_000; // Buffer added to simulation times (except Date.now())
const PARTIAL_RESULT_INTERVAL = 2_000; // Emit a running tally every this many simulations

export class TournamentPrediction {
  private readonly parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  predictTournament(
    tournamentId: string,
    callback: (data: { simulationTimes?: number[]; data?: TournamentPredictionResult; progress: number }) => void,
    numSimulations: number = NUM_SIMULATIONS,
  ): void {
    const tournament = this.parent.tournaments.getTournament(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament not found: ${tournamentId}`);
    }

    const simulationTimePoints = this.getSimulationTimePoints(tournament).toReversed();
    // All time points use the same seeds, so a change between two points comes from the played games
    const seed = Math.floor(Math.random() * 2 ** 31);

    callback({
      simulationTimes: simulationTimePoints,
      progress: 0,
    });

    for (let i = 0; i < simulationTimePoints.length; i++) {
      const timePoint = simulationTimePoints[i];
      const result = this.predictTournamentAtTime(tournamentId, timePoint, seed, numSimulations, (partial, done) =>
        callback({
          data: partial,
          progress: (i + done) / simulationTimePoints.length,
        }),
      );
      callback({
        data: result,
        progress: (i + 1) / simulationTimePoints.length,
      });
    }
  }

  private getSimulationTimePoints(tournament: Tournament): number[] {
    const timePoints: number[] = [];
    const now = Date.now();

    // Has not started yet: only simulate at start date
    if (tournament.startDate > now) {
      timePoints.push(tournament.startDate + SIMULATION_TIME_BUFFER);
      return timePoints;
    }

    // Add start date
    timePoints.push(tournament.startDate + SIMULATION_TIME_BUFFER);

    // Add each completed game time
    const completedGameTimes = tournament.findAllCompletedGameTimes();
    for (const gameTime of completedGameTimes) {
      timePoints.push(gameTime + SIMULATION_TIME_BUFFER);
    }

    // Add each skipped game time
    const skippedGameTimes = this.findAllSkippedGameTimes(tournament);
    for (const gameTime of skippedGameTimes) {
      timePoints.push(gameTime + SIMULATION_TIME_BUFFER);
    }

    // Add current time if tournament is ongoing (not ended)
    if (!tournament.endDate) {
      timePoints.push(now); // No buffer for Date.now()
    }

    // Remove duplicates and sort
    return [...new Set(timePoints)].sort((a, b) => a - b);
  }

  private findAllSkippedGameTimes(tournament: Tournament): number[] {
    return tournament.skippedGames.map((s) => s.time);
  }

  private predictTournamentAtTime(
    tournamentId: string,
    simulationTime: number,
    seed: number,
    numSimulations: number = NUM_SIMULATIONS,
    /** Gets a running tally and the part of this time point that is done */
    onPartialResult?: (result: TournamentPredictionResult, done: number) => void,
  ): TournamentPredictionResult {
    const winCounts = new Map<string, { wins: number }>();

    // Create state at this point in time with only events up to simulationTime
    const eventsUpToTime = this.parent.events.filter((e) => {
      if (e.type === EventTypeEnum.GAME_CREATED && e.data.playedAt) {
        return e.data.playedAt <= simulationTime;
      }
      return e.time <= simulationTime;
    });

    const stateAtTime = new TennisTable({ events: eventsUpToTime, referenceTime: simulationTime });

    const tournamentAtTime = stateAtTime.tournaments.getTournament(tournamentId);
    if (!tournamentAtTime) {
      return {
        time: simulationTime,
        players: {},
        confidence: 0,
        simulations: numSimulations,
        method: "simulation",
      };
    }

    let gamesSimulatedCount = 0;
    let totalConfidenceSum = 0;

    // Run Monte Carlo simulations from this time point. An exact result needs only one
    let samples = numSimulations;
    let resultMethod: PredictionMethod = "simulation";
    for (let i = 0; i < samples; i++) {
      const { chances, method, gamesCount, confidenceSum } = tournamentAtTime.predictWinChances(
        stateAtTime,
        simulationTime,
        seed + i,
      );
      if (i === 0) {
        resultMethod = method;
        if (method === "hybrid") samples = Math.max(1, Math.ceil(numSimulations / HYBRID_SAMPLE_DIVISOR));
      }

      chances.forEach((chance, player) => {
        if (!winCounts.has(player)) {
          winCounts.set(player, { wins: 0 });
        }
        winCounts.get(player)!.wins += chance;
      });

      gamesSimulatedCount += gamesCount;
      totalConfidenceSum += confidenceSum;

      if (method === "exact") {
        return this.buildResult(simulationTime, winCounts, totalConfidenceSum, gamesSimulatedCount, 1, method);
      }

      // Deliver a running tally so long simulations show progress instead of nothing
      const simulationsDone = i + 1;
      if (onPartialResult && simulationsDone % PARTIAL_RESULT_INTERVAL === 0 && simulationsDone < samples) {
        onPartialResult(
          this.buildResult(
            simulationTime,
            winCounts,
            totalConfidenceSum,
            gamesSimulatedCount,
            simulationsDone,
            resultMethod,
          ),
          simulationsDone / samples,
        );
      }
    }

    return this.buildResult(simulationTime, winCounts, totalConfidenceSum, gamesSimulatedCount, samples, resultMethod);
  }

  private buildResult(
    simulationTime: number,
    winCounts: Map<string, { wins: number }>,
    totalConfidenceSum: number,
    gamesSimulatedCount: number,
    simulations: number,
    method: PredictionMethod,
  ): TournamentPredictionResult {
    return {
      time: simulationTime,
      // Copy the counts, the map keeps mutating as the remaining simulations run
      players: Object.fromEntries([...winCounts].map(([playerId, { wins }]) => [playerId, { wins }])),
      confidence: totalConfidenceSum / Math.max(1, gamesSimulatedCount),
      simulations,
      method,
    };
  }
}

export type TournamentPredictionResult = {
  time: number;
  /** The expected number of the simulations that each player wins. With an exact result, the chance of a win */
  players: Record<string, { wins: number }>;
  confidence: number;
  /**
   * How many simulations these counts are based on. Less than the requested number while still
   * running, 1 for an exact result, and fewer samples for a hybrid result.
   */
  simulations: number;
  method: PredictionMethod;
};
