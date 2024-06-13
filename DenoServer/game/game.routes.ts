import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import {
  CreateGamePayload,
  DeleteGamePayload,
  Game,
  createGame,
  deleteAllGames,
  deleteGame,
  getAllGames,
  getGame,
  getGamesByPlayer,
  importGame,
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
   * Import a games
   */
  api.post("/import-games", async (context) => {
    const payload =
      (await context.request.body.json()) as (CreateGamePayload & {
        time: number;
      })[];

    const importedGames: Game[] = [];
    const skippedGames: Game[] = [];

    for (const game of payload) {
      const created = await importGame(game);
      if (!created) {
        skippedGames.push(game);
        continue;
      } else {
        importedGames.push(created);
      }
    }

    context.response.body = {
      countImported: importedGames.length,
      importedGames,
      countSkipped: skippedGames.length,
      skippedGames,
    };
  });

  /**
   * Delete one game
   */
  api.delete("/game", async (context) => {
    const payload = (await context.request.body.json()) as DeleteGamePayload;
    if (!payload) {
      throw new Error("payload is required");
    }

    const game = await getGame(payload);
    if (!game) {
      context.response.status = 404;
      return;
    }
    await deleteGame(game);
    context.response.body = 204;
  });

  /**
   * Delete all games
   */
  api.delete("/games", async (context) => {
    const deleted = await deleteAllGames();
    context.response.body = deleted;
  });
}
