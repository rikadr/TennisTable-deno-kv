import {
  EventType,
  EventTypeEnum,
  GameCreated,
  GameScore,
  PlayerCreated,
} from "../../../client/client-db/event-store/event-types";
import { newId } from "../../../common/nani-id";

// Player configuration
export interface MockPlayer {
  name: string;
  skillLevel: number; // 0-1 representing player strength
  gameProbability: number; // 0-1 representing likelihood of playing on a given day
}

// Game simulation configuration
interface GameConfig {
  setPoints: number;
  gameSets: number;
}

export class CreateMockData {
  private players: MockPlayer[];
  private simulationPeriod: number;
  private gameConfig: GameConfig;
  private startDate: number;
  private endDate: number;
  private playerIdMap: Map<string, string>; // Maps player name to player ID

  constructor(
    players: MockPlayer[],
    simulationPeriod: number,
    gameConfig: GameConfig = { setPoints: 11, gameSets: 3 },
  ) {
    this.players = players;
    this.simulationPeriod = simulationPeriod;
    this.gameConfig = gameConfig;
    this.endDate = Date.now();
    this.startDate = this.endDate - simulationPeriod * 24 * 60 * 60 * 1000;
    this.playerIdMap = new Map();
  }

  /**
   * Calculate the probability that player1 wins a single ball against player2
   */
  private calculateBallWinChance(player1: MockPlayer, player2: MockPlayer): number {
    const skillDiff = player1.skillLevel - player2.skillLevel;
    // Use a sigmoid-like function to convert skill difference to win probability
    // This ensures the probability is always between 0 and 1
    // When skills are equal, probability is 0.5
    // The multiplier controls how quickly probability changes with skill difference
    return 1 / (1 + Math.exp(-0.9 * skillDiff));
  }

  /**
   * Simulate a single ball result
   */
  private simulateBall(ballWinChance: number): "win" | "loss" {
    return Math.random() < ballWinChance ? "win" : "loss";
  }

  /**
   * Simulate a single set and return the points for both players
   */
  private simulateSet(ballWinChance: number): { player1Points: number; player2Points: number } {
    let player1Points = 0;
    let player2Points = 0;

    while (
      Math.max(player1Points, player2Points) < this.gameConfig.setPoints ||
      Math.abs(player1Points - player2Points) < 2
    ) {
      this.simulateBall(ballWinChance) === "win" ? player1Points++ : player2Points++;
    }

    return { player1Points, player2Points };
  }

  /**
   * Simulate a complete game between two players
   */
  private simulateGame(
    player1: MockPlayer,
    player2: MockPlayer,
  ): {
    winnerId: string;
    loserId: string;
    setsWon: { gameWinner: number; gameLoser: number };
    setPoints: { gameWinner: number; gameLoser: number }[];
  } {
    const ballWinChance = this.calculateBallWinChance(player1, player2);
    let player1Sets = 0;
    let player2Sets = 0;
    const setPointsResults: { player1Points: number; player2Points: number }[] = [];

    // Play sets until one player wins (best of gameSets)
    const setsToWin = Math.ceil(this.gameConfig.gameSets / 2);

    while (player1Sets < setsToWin && player2Sets < setsToWin) {
      const setResult = this.simulateSet(ballWinChance);
      setPointsResults.push(setResult);

      if (setResult.player1Points > setResult.player2Points) {
        player1Sets++;
      } else {
        player2Sets++;
      }
    }

    const player1Won = player1Sets > player2Sets;
    const player1Id = this.playerIdMap.get(player1.name)!;
    const player2Id = this.playerIdMap.get(player2.name)!;

    return {
      winnerId: player1Won ? player1Id : player2Id,
      loserId: player1Won ? player2Id : player1Id,
      setsWon: {
        gameWinner: player1Won ? player1Sets : player2Sets,
        gameLoser: player1Won ? player2Sets : player1Sets,
      },
      setPoints: setPointsResults.map((result) => ({
        gameWinner: player1Won ? result.player1Points : result.player2Points,
        gameLoser: player1Won ? result.player2Points : result.player1Points,
      })),
    };
  }

  /**
   * Generate a random time within a specific day
   */
  private randomTimeInDay(dayStart: number): number {
    // Generate time between 8 AM and 10 PM (14 hours)
    const startHour = 8 * 60 * 60 * 1000;
    const hourRange = 14 * 60 * 60 * 1000;
    return dayStart + startHour + Math.random() * hourRange;
  }

  /**
   * Determine which players are playing on a given day
   */
  private getPlayersForDay(): MockPlayer[] {
    return this.players.filter((player) => Math.random() < player.gameProbability);
  }

  /**
   * Find the player from the list that has the most similar skill level to targetPlayer
   */
  private findClosestSkillOpponent(targetPlayer: MockPlayer, availablePlayers: MockPlayer[]): MockPlayer | null {
    if (availablePlayers.length === 0) return null;

    let closestOpponent = availablePlayers[0];
    let minSkillDiff = Math.abs(targetPlayer.skillLevel - availablePlayers[0].skillLevel);

    for (let i = 1; i < availablePlayers.length; i++) {
      const skillDiff = Math.abs(targetPlayer.skillLevel - availablePlayers[i].skillLevel);
      if (skillDiff < minSkillDiff) {
        minSkillDiff = skillDiff;
        closestOpponent = availablePlayers[i];
      }
    }

    return closestOpponent;
  }

  /**
   * Create matchups for a single round
   * Returns array of [player1, player2] pairs
   */
  private createRoundMatchups(availablePlayers: MockPlayer[]): [MockPlayer, MockPlayer][] {
    if (availablePlayers.length < 2) return [];

    const matchups: [MockPlayer, MockPlayer][] = [];
    const playersInRound = [...availablePlayers];
    const playedThisRound = new Set<string>();

    // Sort by highest gameProbability
    playersInRound.sort((a, b) => b.gameProbability - a.gameProbability);

    while (playersInRound.length >= 2) {
      // Pick player 1 from the start of the list (hasn't played this round)
      const player1Index = playersInRound.findIndex((p) => !playedThisRound.has(p.name));
      if (player1Index === -1) break;

      const player1 = playersInRound[player1Index];
      playersInRound.splice(player1Index, 1);

      // Find remaining players who haven't played this round
      const remainingPlayers = playersInRound.filter((p) => !playedThisRound.has(p.name));

      if (remainingPlayers.length === 0) {
        // Only one player left - match them with highest gameProbability from original list
        const opponent = availablePlayers
          .filter((p) => p.name !== player1.name)
          .sort((a, b) => b.gameProbability - a.gameProbability)[0];

        if (opponent) {
          matchups.push([player1, opponent]);
          playedThisRound.add(player1.name);
          playedThisRound.add(opponent.name);
        }
        break;
      }

      // Find opponent with most similar skill level to player1
      const player2 = this.findClosestSkillOpponent(player1, remainingPlayers);

      if (player2) {
        matchups.push([player1, player2]);
        playedThisRound.add(player1.name);
        playedThisRound.add(player2.name);

        // Remove player2 from available list
        const player2Index = playersInRound.findIndex((p) => p.name === player2.name);
        if (player2Index !== -1) {
          playersInRound.splice(player2Index, 1);
        }
      }
    }

    return matchups;
  }

  /**
   * Generate all events for the simulation
   */
  public generate(): EventType[] {
    const events: EventType[] = [];
    let currentTime = this.startDate;

    // Generate PLAYER_CREATED events first and store their IDs
    for (const player of this.players) {
      const playerId = newId();
      const playerCreatedEvent: PlayerCreated = {
        time: currentTime++,
        stream: playerId,
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: player.name },
      };
      events.push(playerCreatedEvent);
      this.playerIdMap.set(player.name, playerId);
    }

    // Simulate games day by day
    const dayInMs = 24 * 60 * 60 * 1000;
    let currentDay = this.startDate;

    while (currentDay < this.endDate) {
      const initialPlayersToday = this.getPlayersForDay();

      if (initialPlayersToday.length < 2) {
        currentDay += dayInMs;
        continue;
      }

      // Multiple rounds per day
      let roundPlayers = [...initialPlayersToday];

      while (roundPlayers.length >= 2) {
        // Create matchups for this round
        const matchups = this.createRoundMatchups(roundPlayers);

        if (matchups.length === 0) break;

        // Simulate each game in this round
        for (const [player1, player2] of matchups) {
          const gameResult = this.simulateGame(player1, player2);
          const gameTime = this.randomTimeInDay(currentDay);

          // Ensure unique timestamps
          const gameCreatedTime = Math.max(gameTime, currentTime);
          currentTime = gameCreatedTime + 1;

          const gameStream = newId();

          // Create GAME_CREATED event with player IDs
          const gameCreatedEvent: GameCreated = {
            time: gameCreatedTime,
            stream: gameStream,
            type: EventTypeEnum.GAME_CREATED,
            data: {
              winner: gameResult.winnerId,
              loser: gameResult.loserId,
              playedAt: gameCreatedTime,
            },
          };
          events.push(gameCreatedEvent);

          // Create GAME_SCORE event
          const gameScoreEvent: GameScore = {
            time: currentTime++,
            stream: gameStream,
            type: EventTypeEnum.GAME_SCORE,
            data: {
              setsWon: gameResult.setsWon,
              setPoints: gameResult.setPoints,
            },
          };
          events.push(gameScoreEvent);
        }

        // Determine who plays in the next round
        // Each player has their gameProbability chance to play another game
        roundPlayers = roundPlayers.filter((player) => Math.random() < player.gameProbability);
      }

      currentDay += dayInMs;
    }

    return events;
  }
}
