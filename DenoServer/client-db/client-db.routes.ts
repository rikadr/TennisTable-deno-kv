import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { getAllGames } from "../game/game.ts";
import { DEFAULT_PROFILE_PHOTO, getAllPlayers, getProfilePicture } from "../player/player.ts";
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

    // Not very efficient to get pictures one by on per player. Suggest bulk fetch and distribute in map in code
    const playersWithPhotos = await Promise.all(
      players.map(async (player) => ({ ...player, photo: (await getProfilePicture(player.name)) || undefined })),
    );

    context.response.body = {
      players: playersWithPhotos,
      defaultProfilePhoto: DEFAULT_PROFILE_PHOTO,
      games,
      tournament: { signedUp },
    };
  });
}
