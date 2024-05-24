import { INITIAL_ELO, calculateELO, getAllPlayersELOMap } from "../elo/elo.ts";
import { getAllGames } from "../game/game.ts";

type PlayerSummary = {
  name: string;
  elo: number;
  wins: number;
  loss: number;
};

export type LeaderboardDTO = {
  rankedPlayers: (PlayerSummary & { rank: number })[];
  unrankedPlayers: (PlayerSummary & { potentialRank: number })[];
};

const GAME_LIMIT_FOR_RANKED = 5;

export async function getLeaderboard(): Promise<LeaderboardDTO> {
  const [allGames] = await Promise.all([getAllGames()]);

  const leaderboardMap = new Map<string, PlayerSummary>();

  function getPlayer(name: string): PlayerSummary {
    const player = leaderboardMap.get(name);
    if (player) return player;
    leaderboardMap.set(name, {
      name,
      elo: INITIAL_ELO,
      wins: 0,
      loss: 0,
    });
    return leaderboardMap.get(name)!;
  }

  allGames.forEach((game) => {
    const winner = getPlayer(game.winner);
    const loser = getPlayer(game.loser);
    winner.wins++;
    loser.loss++;
    const { winnersNewElo, losersNewElo } = calculateELO(winner.elo, loser.elo);
    winner.elo = winnersNewElo;
    loser.elo = losersNewElo;
  });

  const rankedPlayers: LeaderboardDTO["rankedPlayers"] = Array.from(
    leaderboardMap.values()
  )
    .sort((a, b) => b.elo - a.elo)
    .filter((player) => player.wins + player.loss >= GAME_LIMIT_FOR_RANKED)
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }));

  const unrankedPlayers: LeaderboardDTO["unrankedPlayers"] = Array.from(
    leaderboardMap.values()
  )
    .sort((a, b) => b.elo - a.elo)
    .map((player, index) => ({
      ...player,
      potentialRank: index + 1,
    }))
    .filter((player) => player.wins + player.loss < GAME_LIMIT_FOR_RANKED);

  return {
    rankedPlayers,
    unrankedPlayers,
  };
}
