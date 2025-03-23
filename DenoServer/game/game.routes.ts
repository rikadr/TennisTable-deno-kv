import { Router } from "oak";
import {
  CreateGamePayload,
  DeleteGamePayload,
  Game,
  createGame,
  // deleteAllGames,
  deleteGame,
  getGame,
  importGame,
} from "./game.ts";
import { isAuthenticated, requireAuth } from "../auth-service/middleware.ts";
import { createPlayer, type CreatePlayerPayload } from "../player/player.ts";
import { webSocketClientManager } from "../server.ts";
import { signUp } from "../tournament/tournament.ts";

export function registerGameRoutes(api: Router) {
  /**
   * Create a game
   */
  api.post("/game", async (context) => {
    const payload = (await context.request.body.json()) as CreateGamePayload;

    if (!payload.winner || !payload.loser) {
      throw new Error("winner and loser is required");
    }

    const game = await createGame(payload);
    await webSocketClientManager.reloadCacheAndClients();
    context.response.body = game;
  });

  /**
   * Import db state. Games and plalyers
   */
  api.post("/import-db", async (context) => {
    const {
      players,
      games,
      tournament: { signedUp },
    } = (await context.request.body.json()) as {
      players: CreatePlayerPayload[];
      games: (CreateGamePayload & {
        time: number;
      })[];
      tournament: {
        signedUp: { tournamentId: string; player: string; time: number }[];
      };
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

    for (const signUpPlayer of signedUp) {
      await signUp({ player: signUpPlayer.player, tournamentId: signUpPlayer.tournamentId });
    }

    context.response.body = {
      countImported: importedGames.length,
      importedGames,
      countSkipped: skippedGames.length,
      skippedGames,
      signedUp: signedUp.length,
    };
    await webSocketClientManager.reloadCacheAndClients();
  });

  /**
   * Delete one game
   */
  api.delete("/game", isAuthenticated, requireAuth("game", "delete"), async (context) => {
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
    await webSocketClientManager.reloadCacheAndClients();
    context.response.body = 204;
  });

  /**
   * Delete all games
   */
  // Commented out because it's not used, and is too dangerous to have it enabled
  // api.delete("/games", isAuthenticated, requireAuth("game", "delete"), async (context) => {
  // api.delete("/games", async (context) => {
  //   const deleted = await deleteAllGames();
  //   context.response.body = deleted;
  // });
}
