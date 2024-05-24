import { getAllGames } from "../game/game.ts";
import { Player, getAllPlayers } from "../player/player.ts";

type PlayerWithElo = Player & { elo: number };

const K = 32;
export const INITIAL_ELO = 1_000;

export function calculateELO(winnersElo: number, losersElo: number) {
  // Calculate the expected scores for both players
  const expectedScoreWinner =
    1 / (1 + Math.pow(10, (losersElo - winnersElo) / 400));
  const expectedScoreLoser =
    1 / (1 + Math.pow(10, (winnersElo - losersElo) / 400));

  // Update ELO ratings
  const winnersNewElo = winnersElo + K * (1 - expectedScoreWinner);
  const losersNewElo = losersElo + K * (0 - expectedScoreLoser);

  return {
    winnersNewElo,
    losersNewElo,
  };
}

export async function getAllPlayersELO(): Promise<PlayerWithElo[]> {
  const map = await getAllPlayersELOMap();

  const playersWithElo = Array.from(map.values());
  playersWithElo.sort((a, b) => b.elo - a.elo);
  return playersWithElo;
}

export async function getAllPlayersELOMap(): Promise<
  Map<string, PlayerWithElo>
> {
  const [players, games] = await Promise.all([getAllPlayers(), getAllGames()]);

  const map = new Map<string, PlayerWithElo>();
  players.forEach((player) => {
    map.set(player.name, { ...player, elo: INITIAL_ELO });
  });

  games.forEach((game) => {
    const winner = map.get(game.winner);
    const loser = map.get(game.loser);
    if (winner && loser) {
      const { winnersNewElo, losersNewElo } = calculateELO(
        winner.elo,
        loser.elo
      );
      winner.elo = winnersNewElo;
      loser.elo = losersNewElo;
    }
  });
  return map;
}
