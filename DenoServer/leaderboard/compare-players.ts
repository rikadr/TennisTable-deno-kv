import { INITIAL_ELO, eloCalculator } from "../elo/elo.ts";
import { getAllGames } from "../game/game.ts";
import { getAllPlayers } from "../player/player.ts";

type PlayerComparison = {
  allPlayers: string[];
  graphData: Record<string, number>[];
};

export async function comparePlayers(players: string[]): Promise<PlayerComparison> {
  const graphData: PlayerComparison["graphData"] = [];
  const [allPlayers, allGames] = await Promise.all([getAllPlayers(), getAllGames()]);
  if (players.length === 0) {
    return {
      allPlayers: allPlayers.map((player) => player.name),
      graphData: [],
    };
  }

  const graphEntry: Record<string, number> = {};
  players.forEach((player) => (graphEntry[player] = INITIAL_ELO));
  graphData.push({ ...graphEntry });

  eloCalculator(allGames, allPlayers, (map, game) => {
    if (players.includes(game.winner) || players.includes(game.loser)) {
      if (players.includes(game.winner)) {
        const newElo = map.get(game.winner);
        if (newElo) {
          graphEntry[game.winner] = newElo.elo;
        }
      }
      if (players.includes(game.loser)) {
        const newElo = map.get(game.loser);
        if (newElo) {
          graphEntry[game.loser] = newElo.elo;
        }
      }
      graphData.push({ ...graphEntry });
    }
  });

  return {
    graphData,
    allPlayers: allPlayers.map((p) => p.name).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
  };
}
