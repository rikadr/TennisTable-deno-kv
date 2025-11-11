import { dateString } from "../../../pages/player/player-achievements";
import { EventType, EventTypeEnum } from "../event-store/event-types";
import { TennisTable } from "../tennis-table";
import { Tournament } from "./tournament";

const NUM_SIMULATIONS = 1; // 10_000 at least. 1_000 for higher performance
const PLAYER_TIME_OFFSET = -1; // Players are created before tournament starts

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

    // Get all time points to simulate at
    const simulationTimePoints = this.getSimulationTimePoints(tournament);
    if (tournament.endDate) {
      console.log(
        "some is after",
        simulationTimePoints.some((time) => time > tournament.endDate!),
      );
    } else {
      console.log("Not ended yet");
    }
    console.log("simulationTimePoints", simulationTimePoints);

    const results: TournamentPredictionResult[] = [];

    // Run simulations for each time point
    for (const timePoint of simulationTimePoints) {
      console.log("Predicting " + dateString(timePoint));

      const result = this.predictTournamentAtTime(tournamentId, timePoint);
      results.push(result);
    }

    return results;
  }

  private getSimulationTimePoints(tournament: Tournament): number[] {
    // Get all completed game times
    const completedGameTimes = tournament.findAllCompletedGameTimes();

    // Build time points: startDate, each completed game time, and now
    const timePoints = [tournament.startDate, ...completedGameTimes, tournament.endDate || Date.now()];

    // Remove duplicates and sort
    return [...new Set(timePoints)].sort((a, b) => a - b);
  }

  private predictTournamentAtTime(tournamentId: string, simulationTime: number): TournamentPredictionResult {
    const winCounts = new Map<string, { wins: number }>();

    // Create state at this point in time with only events up to simulationTime
    const eventsUpToTime = this.parent.events.filter((e) => e.time <= simulationTime);
    const stateAtTime = new TennisTable({ events: eventsUpToTime });

    // Calculate Elo predictions for this specific time

    console.log("calculatePlayerFractionsForToday");
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
    console.log("prepareSimulationData");
    const { playerEvents, existingGameEvents } = this.prepareSimulationData(
      stateAtTime,
      tournamentAtTime,
      simulationTime,
    );

    let totalGamesSimulated = 0;
    let totalConfidenceSum = 0;

    // Run Monte Carlo simulations from this time point
    for (let i = 0; i < NUM_SIMULATIONS; i++) {
      console.log("runSingleSimulation", i + 1);
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

  private prepareSimulationData(stateAtTime: TennisTable, tournamentAtTime: Tournament, simulationTime: number) {
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

    // Get all games that have been completed up to this simulation time
    const completedGameTimes = tournamentAtTime.findAllCompletedGameTimes();
    const completedUpToNow = completedGameTimes.filter((t: number) => t <= simulationTime);

    // Extract existing game events that have been completed
    const existingGameEvents: EventType[] = stateAtTime.events.filter(
      (e) => e.type === EventTypeEnum.GAME_CREATED && completedUpToNow.includes(e.data.playedAt),
    );

    return { playerEvents, existingGameEvents };
  }

  private runSingleSimulation(
    tournamentId: string,
    playerEvents: EventType[],
    existingGameEvents: EventType[],
    currentTime: number,
    stateForElo: TennisTable,
  ): SimulationResult {
    let simulatedState = new TennisTable({
      events: [...playerEvents, ...existingGameEvents],
    });
    let simTournament = simulatedState.tournaments.getTournament(tournamentId)!;

    const simulatedGameEvents: EventType[] = [];
    let currentGameTime = currentTime;
    let gamesSimulated = 0;
    let confidenceSum = 0;
    let gameIdCounter = 0;

    let pendingGames = simTournament.findAllPendingGames();
    let iPending = 0;
    while (!simTournament.winner && pendingGames.length > 0) {
      currentGameTime++;
      iPending++;
      console.log("iPending", iPending);
      console.log("" + pendingGames.length + " pending games");
      if (pendingGames.length === 1) {
        console.log(pendingGames);
      }
      if (iPending > 100) {
        throw new Error("Unexpected unable to fill all tournament games in under 100 loops");
      }

      // Simulate all games in the current round
      for (const { player1, player2 } of pendingGames) {
        const { winner, loser, confidence } = this.simulateGame(player1, player2, stateForElo);

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
