import { EventType, EventTypeEnum } from "../event-store/event-types";
import { TennisTable } from "../tennis-table";
import { Tournament } from "./tournament";

const NUM_SIMULATIONS = 1_000; // 10_000 at least. 1_000 for higher performance
const PLAYER_TIME_OFFSET = -1; // Players are created before tournament starts
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
    const eventsUpToTime = this.parent.events.filter((e) => e.time <= simulationTime);
    const stateAtTime = new TennisTable({ events: eventsUpToTime });

    // Calculate Elo predictions for this specific time
    stateAtTime.futureElo.calculatePlayerFractionsForToday(simulationTime);

    // Get tournament state at this time
    const tournamentAtTime = stateAtTime.tournaments.getTournament(tournamentId);
    if (!tournamentAtTime) {
      // Tournament doesn't exist at this time, return empty result
      return {
        time: simulationTime,
        players: winCounts,
        confidence: 0,
      };
    }

    const completedGameTimes = tournamentAtTime.findAllCompletedGameTimes();
    const { playerEvents, existingGameEvents } = this.prepareSimulationData(
      stateAtTime,
      tournamentAtTime,
      completedGameTimes,
    );

    let totalGamesSimulated = 0;
    let totalConfidenceSum = 0;

    // Run Monte Carlo simulations from this time point
    for (let i = 0; i < NUM_SIMULATIONS; i++) {
      const result = this.runSingleSimulation(
        tournamentId,
        playerEvents,
        existingGameEvents,
        simulationTime,
        stateAtTime,
      );

      // Record winner
      if (!winCounts.has(result.winner)) {
        winCounts.set(result.winner, { wins: 0 });
      }
      winCounts.get(result.winner)!.wins++;

      totalGamesSimulated += result.gamesSimulated;
      totalConfidenceSum += result.confidenceSum;
    }

    const averageConfidence = totalGamesSimulated > 0 ? totalConfidenceSum / totalGamesSimulated : 0;

    return {
      time: simulationTime,
      players: winCounts,
      confidence: averageConfidence,
    };
  }

  private prepareSimulationData(stateAtTime: TennisTable, tournamentAtTime: Tournament, completedGameTimes: number[]) {
    // Create player events (players join before tournament starts)
    const playerEvents: EventType[] =
      tournamentAtTime.tournamentDb.playerOrder?.map(
        (playerId: string, index: number) =>
          ({
            type: EventTypeEnum.PLAYER_CREATED,
            stream: playerId,
            time: tournamentAtTime.startDate + PLAYER_TIME_OFFSET * (index + 1),
            data: { name: playerId },
          } satisfies EventType),
      ) ?? [];

    const skippedGamesIdsTimesAtTime = tournamentAtTime.skippedGames.map((s) => s.skipId);

    // Filter events to include:
    // 1. Game events for completed games
    // 2. Tournament skip game events (up to simulationTime)
    const existingGameEvents: EventType[] = stateAtTime.events.filter(
      (e) =>
        (e.type === EventTypeEnum.GAME_CREATED && completedGameTimes.includes(e.data.playedAt)) ||
        (e.type === EventTypeEnum.TOURNAMENT_SKIP_GAME &&
          e.stream === tournamentAtTime.id &&
          skippedGamesIdsTimesAtTime.includes(e.data.skipId)),
    );

    return { playerEvents, existingGameEvents };
  }

  private runSingleSimulation(
    tournamentId: string,
    playerEvents: EventType[],
    existingGameEvents: EventType[],
    simulationTime: number,
    stateForElo: TennisTable,
  ): SimulationResult {
    // Create initial simulated state from player events and existing game events
    let simulatedState = new TennisTable({
      events: [...playerEvents, ...existingGameEvents],
    });
    let simTournament = simulatedState.tournaments.getTournament(tournamentId)!;

    const simulatedGameEvents: EventType[] = [];
    let gamesSimulated = 0;
    let confidenceSum = 0;
    let gameIdCounter = 0;

    let iterationCount = 0;
    while (!simTournament.winner && simTournament.findAllPendingGames().length > 0) {
      iterationCount++;

      if (iterationCount > 20) {
        throw new Error("Simulation exceeded 20 iterations without finding a winner");
      }

      const pendingGames = simTournament.findAllPendingGames();

      // Get the time for the next event (increment from last event in simulated state)
      const lastEventTime =
        simulatedState.events.length > 0
          ? simulatedState.events[simulatedState.events.length - 1].time
          : existingGameEvents.length > 0
          ? Math.max(...existingGameEvents.map((e) => e.time))
          : playerEvents[playerEvents.length - 1].time;

      // Simulate all pending games with incrementing times
      const newGamesThisIteration: EventType[] = [];
      for (let i = 0; i < pendingGames.length; i++) {
        const { player1, player2 } = pendingGames[i];
        const { winner, loser, confidence } = this.simulateGame(player1, player2, stateForElo);

        const gameTime = lastEventTime + 1 + i;

        // Ensure we don't exceed simulation time
        if (gameTime > simulationTime) {
          throw new Error(`Simulated game time (${gameTime}) would exceed simulation time (${simulationTime})`);
        }

        const gameEvent: EventType = {
          type: EventTypeEnum.GAME_CREATED,
          stream: `sim-${gameIdCounter++}`,
          time: gameTime,
          data: {
            playedAt: gameTime,
            winner,
            loser,
          },
        };

        newGamesThisIteration.push(gameEvent);
        simulatedGameEvents.push(gameEvent);
        gamesSimulated++;
        confidenceSum += confidence;
      }

      // Recreate simulated state with all events including new simulated games
      simulatedState = new TennisTable({
        events: [...playerEvents, ...existingGameEvents, ...simulatedGameEvents],
      });
      simTournament = simulatedState.tournaments.getTournament(tournamentId)!;
    }

    if (!simTournament.winner) {
      throw new Error(`Simulation failed to produce a winner for tournament: ${tournamentId}`);
    }

    return {
      winner: simTournament.winner,
      gamesSimulated,
      confidenceSum,
    };
  }

  private simulateGame(
    player1: string,
    player2: string,
    stateForElo: TennisTable,
  ): { winner: string; loser: string; confidence: number } {
    const fraction = stateForElo.futureElo.getPredictedFractionForTwoPlayers(player1, player2);

    if (!fraction) {
      // No prediction available, default to 50/50 with low confidence
      const player1Wins = Math.random() < 0.5;
      return {
        winner: player1Wins ? player1 : player2,
        loser: player1Wins ? player2 : player1,
        confidence: 0,
      };
    }

    // Player 1 wins if random number is less than their predicted fraction
    const player1Wins = Math.random() < fraction.fraction;

    return {
      winner: player1Wins ? player1 : player2,
      loser: player1Wins ? player2 : player1,
      confidence: fraction.confidence,
    };
  }
}

type SimulationResult = {
  winner: string;
  gamesSimulated: number;
  confidenceSum: number;
};

type TournamentPredictionResult = {
  time: number;
  players: Map<string, { wins: number }>;
  confidence: number;
};
