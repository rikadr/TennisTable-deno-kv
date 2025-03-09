import { getAllGames } from "../game/game.ts";
import { getAllPlayers, getProfilePicture, DEFAULT_PROFILE_PHOTO } from "../player/player.ts";
import { getAllSignedUp } from "../tournament/tournament.ts";

export async function getClientDbData() {
  const [players, games, signedUp] = await Promise.all([getAllPlayers(), getAllGames(), getAllSignedUp()]);

  // Not very efficient to get pictures one by on per player. Suggest bulk fetch and distribute in map in code
  const playersWithPhotos = await Promise.all(
    players.map(async (player) => ({ ...player, photo: (await getProfilePicture(player.name)) || undefined })),
  );

  return {
    players: playersWithPhotos,
    defaultProfilePhoto: DEFAULT_PROFILE_PHOTO,
    games,
    tournament: { signedUp },
  };
}
