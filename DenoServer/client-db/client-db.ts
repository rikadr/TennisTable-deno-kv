import { getAllGames } from "../game/game.ts";
import { getAllPlayers } from "../player/player.ts";
import { getAllSignedUp } from "../tournament/tournament.ts";

export async function getClientDbData() {
  const [players, games, signedUp] = await Promise.all([getAllPlayers(), getAllGames(), getAllSignedUp()]);
  return { players, games, tournament: { signedUp } };
}
