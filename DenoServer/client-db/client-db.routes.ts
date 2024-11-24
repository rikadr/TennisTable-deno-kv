import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { getAllGames } from "../game/game.ts";
import { getAllPlayers } from "../player/player.ts";
import { getAllSignedUp } from "../tournament/tournament.ts";

// -----------------------------------------------------------------------------------------------
//  Client side "database". This is a simple in-memory database/data storage that is used to store
//  all the data you need to run the client side of the application.
// -----------------------------------------------------------------------------------------------

export function registerClientDbRoutes(api: Router) {
  /**
   * Get client db data
   */
  api.get("/client-db", async (context) => {
    const [players, games, signedUp] = await Promise.all([getAllPlayers(), getAllGames(), getAllSignedUp()]);
    context.response.body = { players, games, tournament: { signedUp } };
  });
}
