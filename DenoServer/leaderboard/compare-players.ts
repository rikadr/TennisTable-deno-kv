import { INITIAL_ELO, calculateELO } from "../elo/elo.ts";
import { getAllGames } from "../game/game.ts";
import { getAllPlayers } from "../player/player.ts";

type PlayerComparison = {
  allPlayers: string[];
  graphData: Record<string, number>[];
};

export async function comparePlayers(
  players: string[]
): Promise<PlayerComparison> {
  const graphData: PlayerComparison["graphData"] = [];
  const [allPlayers, allGames] = await Promise.all([
    getAllPlayers(),
    getAllGames(),
  ]);
  if (players.length === 0) {
    return {
      allPlayers: allPlayers.map((player) => player.name),
      graphData: [],
    };
  }

  const map = new Map<string, number>();
  allPlayers.forEach((player) => {
    map.set(player.name, INITIAL_ELO);
  });

  const graphEntry: Record<string, number> = {};
  players.forEach((player) => {
    const elo = map.get(player);
    if (elo) {
      graphEntry[player] = elo;
    }
  });
  graphData.push({ ...graphEntry });

  allGames.forEach((game) => {
    const winner = map.get(game.winner);
    const loser = map.get(game.loser);
    if (winner && loser) {
      const { winnersNewElo, losersNewElo } = calculateELO(winner, loser);
      map.set(game.winner, winnersNewElo);
      map.set(game.loser, losersNewElo);
    }
    if (players.includes(game.winner) || players.includes(game.loser)) {
      if (players.includes(game.winner)) {
        const newElo = map.get(game.winner);
        if (newElo) {
          graphEntry[game.winner] = newElo;
        }
      }
      if (players.includes(game.loser)) {
        const newElo = map.get(game.loser);
        if (newElo) {
          graphEntry[game.loser] = newElo;
        }
      }
      graphData.push({ ...graphEntry });
    }
  });

  return {
    graphData,
    allPlayers: Array.from(map.keys()).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    ),
  };
}
