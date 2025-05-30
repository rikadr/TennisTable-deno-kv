import { GameCreated, GameDeleted, GameScore } from "../event-types";
import { ValidatorResponse } from "./validator-types";

export type Game = { id: string; playedAt: number; winner: string; loser: string; score?: GameScore["data"] };

export class GamesProjector {
  #gamesMap = new Map<string, Game>();

  get games(): Game[] {
    return Array.from(this.#gamesMap.values()).sort((a, b) => a.playedAt - b.playedAt);
  }

  getGameById(gameId?: string | null) {
    if (!gameId) return undefined;
    return this.#gamesMap.get(gameId);
  }

  createGame(event: GameCreated) {
    const game: Game = {
      id: event.stream,
      playedAt: event.data.playedAt,
      winner: event.data.winner,
      loser: event.data.loser,
    };
    this.#gamesMap.set(event.stream, game);
  }

  setScore(event: GameScore) {
    if (this.#gamesMap.has(event.stream)) {
      this.#gamesMap.get(event.stream)!.score = event.data;
    }
  }

  validateCreateGame(event: GameCreated): ValidatorResponse {
    if (event.data.winner === event.data.loser) {
      return { valid: false, message: "Winner and loser cannot be the same" };
    }
    const games = Array.from(this.#gamesMap.values());
    if (games.some((game) => game.id === event.stream)) {
      return { valid: false, message: "Game stream already exists" };
    }
    if (games.some((game) => game.playedAt === event.data.playedAt)) {
      return { valid: false, message: "Game played at same time" };
    }
    // Check if both players exist?
    return { valid: true };
  }

  deleteGame(event: GameDeleted) {
    this.#gamesMap.delete(event.stream);
  }

  validateDeleteGame(event: GameDeleted): ValidatorResponse {
    if (this.#gamesMap.has(event.stream) === false) {
      return { valid: false, message: "Game does not exist" };
    }
    return { valid: true };
  }

  validateScoreGame(event: GameScore): ValidatorResponse {
    if (event.data.setsWon.gameWinner <= event.data.setsWon.gameLoser) {
      return { valid: false, message: "Winner must win more sets than loser" };
    }

    if (event.data.setPoints && event.data.setPoints.every((set) => set.gameWinner === 0 && set.gameLoser === 0)) {
      return {
        valid: false,
        message: "If no points are recorded, the setPoints should not be included in the event data",
      };
    }

    if (event.data.setPoints && event.data.setPoints.some((set) => set.gameWinner === set.gameLoser)) {
      return { valid: false, message: "Points are invalid. No sets can be tied" };
    }

    const gameWinnerSetPointsWins = event.data.setPoints?.reduce((wins, set) => {
      if (set.gameWinner > set.gameLoser) wins++;
      return wins;
    }, 0);
    const gameLoserSetPointsWins = event.data.setPoints?.reduce((wins, set) => {
      if (set.gameLoser > set.gameWinner) wins++;
      return wins;
    }, 0);

    if (gameWinnerSetPointsWins !== undefined && gameLoserSetPointsWins !== undefined) {
      if (gameWinnerSetPointsWins <= gameLoserSetPointsWins) {
        return { valid: false, message: "Points are invalid. Winner must win more sets than loser" };
      }
      if (gameWinnerSetPointsWins !== event.data.setsWon.gameWinner) {
        return { valid: false, message: "Points are invalid. Winner must win the correct amount of sets" };
      }
      if (gameLoserSetPointsWins !== event.data.setsWon.gameLoser) {
        return { valid: false, message: "Points are invalid. Loser must win the correct amount of sets" };
      }
    }

    return { valid: true };
  }
}
