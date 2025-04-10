import { GameCreated, GameDeleted } from "../event-types";
import { ValidatorResponse } from "./validator-types";

export type Game = { id: string; playedAt: number; winner: string; loser: string };

export class GamesProjector {
  #gamesMap = new Map<string, Game>();

  get games(): Game[] {
    return Array.from(this.#gamesMap.values()).sort((a, b) => a.playedAt - b.playedAt);
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
}
