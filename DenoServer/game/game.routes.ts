import { Router } from "oak";
import {
  CreateGamePayload,
  DeleteGamePayload,
  Game,
  createGame,
  deleteAllGames,
  deleteGame,
  getGame,
  importGame,
} from "./game.ts";
import { isAuthenticated } from "../auth-service/middleware.ts";
import { WebSocketClientManager } from "../web-socket/web-socket-client-manager.ts";
import { createPlayer, type CreatePlayerPayload } from "../player/player.ts";

export function registerGameRoutes(api: Router, webSocketClientManager: WebSocketClientManager) {
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
   * Import db state. Games and plalyers
   */
  api.post("/import-db", async (context) => {
    const { players, games } = (await context.request.body.json()) as {
      players: CreatePlayerPayload[];
      games: (CreateGamePayload & {
        time: number;
      })[];
    };

    for (const player of players) {
      try {
        await createPlayer(player);
      } catch (error) {
        console.error("Failed to create player", player, error);
      }
    }

    const importedGames: Game[] = [];
    const skippedGames: Game[] = [];

    for (const game of games) {
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
  api.delete("/game", isAuthenticated, async (context) => {
    // requireAuth("game", "delete") // Auth requirement is removed because auth is not working properly atm
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
  api.delete("/games", isAuthenticated, async (context) => {
    // requireAuth("game", "delete") // Auth requirement is removed because auth is not working properly atm
    const deleted = await deleteAllGames();
    context.response.body = deleted;
  });
}
