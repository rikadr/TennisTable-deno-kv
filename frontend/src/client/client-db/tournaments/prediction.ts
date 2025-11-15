import { EventTypeEnum } from "../event-store/event-types";
import { TennisTable } from "../tennis-table";
import { Tournament } from "./tournament";

export const NUM_SIMULATIONS = 3_000; // 10_000 at least. 1_000 for higher performance
const SIMULATION_TIME_BUFFER = 10_000; // Buffer added to simulation times (except Date.now())

export class TournamentPrediction {
  private readonly parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  predictTournament(tournamentId: string): TournamentPredictionResult[] {
    const tournament = this.parent.tournaments.getTournament(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament not found: ${tournamentId}`);
    }

    const simulationTimePoints = this.getSimulationTimePoints(tournament);

    const results: TournamentPredictionResult[] = [];

    for (const timePoint of simulationTimePoints) {
      const result = this.predictTournamentAtTime(tournamentId, timePoint);
      results.push(result);
    }

    return results;
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

  private predictTournamentAtTime(tournamentId: string, simulationTime: number): TournamentPredictionResult {
    const winCounts = new Map<string, { wins: number }>();

    // Create state at this point in time with only events up to simulationTime
    const eventsUpToTime = this.parent.events.filter((e) => {
      if (e.type === EventTypeEnum.GAME_CREATED && e.data.playedAt) {
        return e.data.playedAt <= simulationTime;
      }
      return e.time <= simulationTime;
    });

    const stateAtTime = new TennisTable({ events: eventsUpToTime }); // TODO Performance test impact of this performance.now before and after
    stateAtTime.futureElo.calculatePlayerFractionsForToday(simulationTime); // TODO Performance test impact of this performance.now before and after

    const tournamentAtTime = stateAtTime.tournaments.getTournament(tournamentId);
    if (!tournamentAtTime) {
      return {
        time: simulationTime,
        players: winCounts,
        confidence: 0,
      };
    }

    let gamesSimulatedCount = 0;
    let totalConfidenceSum = 0;

    // Run Monte Carlo simulations from this time point
    for (let i = 0; i < NUM_SIMULATIONS; i++) {
      const {
        winner,
        gamesSimulatedCount: gsc,
        totalConfidenceSum: tcs,
      } = tournamentAtTime.predictWinner(stateAtTime, simulationTime);

      // Record winner
      if (!winCounts.has(winner)) {
        winCounts.set(winner, { wins: 0 });
      }
      winCounts.get(winner)!.wins++;

      gamesSimulatedCount += gsc;
      totalConfidenceSum += tcs;
    }

    const averageConfidence = totalConfidenceSum / Math.max(1, gamesSimulatedCount);

    return {
      time: simulationTime,
      players: winCounts,
      confidence: averageConfidence,
    };
  }
}

type TournamentPredictionResult = {
  time: number;
  players: Map<string, { wins: number }>;
  confidence: number;
};
