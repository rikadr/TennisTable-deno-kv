import { GameCreated, GameDeleted } from "../event-types";

type Game = { id: string; playedAt: number; winner: string; loser: string };

export class GamesReducer {
  #gamesMap = new Map<string, Game>();

  get games(): Game[] {
    return Array.from(this.#gamesMap.values()).sort((a, b) => b.playedAt - a.playedAt);
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

  deleteGame(event: GameDeleted) {
    this.#gamesMap.delete(event.stream);
  }
}
