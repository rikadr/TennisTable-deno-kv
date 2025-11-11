import { EventType, EventTypeEnum } from "../event-store/event-types";
import { TennisTable } from "../tennis-table";

const NUM_SIMULATIONS = 10_000;
const PLAYER_TIME_OFFSET = -1; // Players are created before tournament starts

export class TournamentPrediction {
  private readonly parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  predictTournament(tournamentId: string): TournamentPredictionResult {
    const winCounts = new Map<string, { wins: number }>();

    // Calculate Elo predictions once (expensive operation)
    this.parent.futureElo.calculatePlayerFractionsForToday();

    const tournament = this.parent.tournaments.getTournament(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament not found: ${tournamentId}`);
    }

    const { playerEvents, existingGameEvents, lastCompletedTime } = this.prepareSimulationData(
      tournament,
      tournamentId,
    );

    let totalGamesSimulated = 0;
    let totalConfidenceSum = 0;

    // Run Monte Carlo simulations
    for (let i = 0; i < NUM_SIMULATIONS; i++) {
      const result = this.runSingleSimulation(tournamentId, playerEvents, existingGameEvents, lastCompletedTime);

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
      players: winCounts,
      confidence: averageConfidence,
    };
  }

  private prepareSimulationData(tournament: any, tournamentId: string) {
    // Create player events (players join before tournament starts)
    const playerEvents: EventType[] =
      tournament.tournamentDb.playerOrder?.map(
        (playerId: string, index: number) =>
          ({
            type: EventTypeEnum.PLAYER_CREATED,
            stream: playerId,
            time: tournament.startDate + PLAYER_TIME_OFFSET * (index + 1),
            data: { name: playerId },
          } satisfies EventType),
      ) ?? [];

    // Get all completed games
    const completedGameTimes = tournament.findAllCompletedGameTimes();
    const lastCompletedTime =
      completedGameTimes.length > 0 ? completedGameTimes[completedGameTimes.length - 1] : tournament.startDate;

    // Extract existing game events that have been completed
    const existingGameEvents: EventType[] = this.parent.events.filter(
      (e) => e.type === EventTypeEnum.GAME_CREATED && completedGameTimes.includes(e.data.playedAt),
    );

    return { playerEvents, existingGameEvents, lastCompletedTime };
  }

  private runSingleSimulation(
    tournamentId: string,
    playerEvents: EventType[],
    existingGameEvents: EventType[],
    lastCompletedTime: number,
  ): SimulationResult {
    let simulatedState = new TennisTable({
      events: [...playerEvents, ...existingGameEvents],
    });
    let simTournament = simulatedState.tournaments.getTournament(tournamentId)!;

    const simulatedGameEvents: EventType[] = [];
    let currentGameTime = lastCompletedTime;
    let gamesSimulated = 0;
    let confidenceSum = 0;
    let gameIdCounter = 0;

    let pendingGames = simTournament.findAllPendingGames();

    while (!simTournament.winner && pendingGames.length > 0) {
      currentGameTime++;

      // Simulate all games in the current round
      for (const { player1, player2 } of pendingGames) {
        const { winner, loser, confidence } = this.simulateGame(player1, player2);

        simulatedGameEvents.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `sim-${gameIdCounter++}`,
          time: currentGameTime,
          data: {
            playedAt: currentGameTime,
            winner,
            loser,
          },
        });

        gamesSimulated++;
        confidenceSum += confidence;
      }

      // Update tournament state with new simulated games
      simulatedState = new TennisTable({
        events: [...playerEvents, ...existingGameEvents, ...simulatedGameEvents],
      });
      simTournament = simulatedState.tournaments.getTournament(tournamentId)!;
      pendingGames = simTournament.findAllPendingGames();
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

  private simulateGame(player1: string, player2: string): { winner: string; loser: string; confidence: number } {
    const fraction = this.parent.futureElo.getPredictedFractionForTwoPlayers(player1, player2);

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
  players: Map<string, { wins: number }>;
  confidence: number;
};
