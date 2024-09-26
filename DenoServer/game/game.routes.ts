import { Router } from "oak";
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
import { isAuthenticated, requireAuth } from "../auth-service/middleware.ts";
import { WebSocketClientManager } from "../web-socket/web-socket-client-manager.ts";

export function registerGameRoutes(api: Router, webSocketClientManager: WebSocketClientManager) {
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
    webSocketClientManager.reloadClients();
    context.response.body = game;
  });

  /**
   * Import a games
   */
  api.post("/import-games", async (context) => {
    const payload = (await context.request.body.json()) as (CreateGamePayload & {
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
    // isAuthenticated, requireAuth("game", "delete") // Auth requirement is removed because auth is not working properly atm
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
    webSocketClientManager.reloadClients();
    context.response.body = 204;
  });

  /**
   * Delete all games
   */
  api.delete("/games", isAuthenticated, requireAuth("game", "delete"), async (context) => {
    const deleted = await deleteAllGames();
    context.response.body = deleted;
  });
}
