import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import {
  CreateGamePayload,
  createGame,
  deleteAllGames,
  getAllGames,
  getGamesByPlayer,
} from "./game.ts";

export function registerGameRoutes(api: Router) {
  /**
   * Get all games
   */
  api.get("/games/:name", async (context) => {
    const name = context.params.name;
    const games = await getGamesByPlayer(name);
    context.response.body = games;
  });

  /**
   * Get all games
   */
  api.get("/games", async (context) => {
    const games = await getAllGames();
    context.response.body = games;
  });

  /**
   * Create a game
   */
  api.post("/game", async (context) => {
    const payload = (await context.request.body.json()) as CreateGamePayload;

    if (!payload.winner || !payload.loser) {
      throw new Error("winner and loser is required");
    }

    const game = await createGame(payload);
    context.response.body = game;
  });

  /**
   * Delete all games
   */
  api.delete("/games", async (context) => {
    const deleted = await deleteAllGames();
    context.response.body = deleted;
  });
}
