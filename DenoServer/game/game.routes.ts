import { Router } from "oak";
import { CreateGamePayload, Game, importGame } from "./game.ts";
import { createPlayer, type CreatePlayerPayload } from "../player/player.ts";
import { webSocketClientManager } from "../server.ts";
import { signUp } from "../tournament/tournament.ts";

export function registerGameRoutes(api: Router) {
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
    webSocketClientManager.reloadClients();
  });
}
