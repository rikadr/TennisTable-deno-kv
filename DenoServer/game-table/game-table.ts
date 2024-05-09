import { getAllPlayersELOMap } from "../elo/elo.ts";
import { getAllGames } from "../game/game.ts";
import { getAllPlayers } from "../player/player.ts";

export type GameTableDTO = {
  players: {
    name: string;
    elo: number;
    wins: { oponent: string; count: number }[];
    loss: { oponent: string; count: number }[];
  }[];
};

export async function getGameTable(): Promise<GameTableDTO> {
  const [allPlayers, allGames, eloMap] = await Promise.all([
    getAllPlayers(),
    getAllGames(),
    getAllPlayersELOMap(),
  ]);

  const gameTableMap = new Map<
    string,
    { name: string; wins: Map<string, number>; loss: Map<string, number> }
  >();

  allPlayers.forEach((player) => {
    gameTableMap.set(player.name, {
      name: player.name,
      wins: new Map(),
      loss: new Map(),
    });
  });

  allGames.forEach((game) => {
    const winner = gameTableMap.get(game.winner);
    const loser = gameTableMap.get(game.loser);
    if (!winner || !loser) return;

    const winnerTally = winner.wins.get(game.loser) || 0;
    winner.wins.set(game.loser, winnerTally + 1);

    const loserTally = loser.loss.get(game.winner) || 0;
    loser.loss.set(game.winner, loserTally + 1);
  });

  return {
    players: Array.from(gameTableMap)
      .map(([name, result]) => ({
        name,
        elo: eloMap.get(name)?.elo || 0,
        wins: Array.from(result.wins).map(([oponent, count]) => ({
          oponent,
          count,
        })),
        loss: Array.from(result.loss).map(([oponent, count]) => ({
          oponent,
          count,
        })),
      }))
      .sort((a, b) => b.elo - a.elo),
  };
}
