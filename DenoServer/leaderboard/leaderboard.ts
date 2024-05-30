import { INITIAL_ELO, calculateELO } from "../elo/elo.ts";
import { getAllGames } from "../game/game.ts";

type PlayerSummary = {
  name: string;
  elo: number;
  wins: number;
  loss: number;
  games: {
    time: number;
    result: "win" | "loss";
    oponent: string;
    eloAfterGame: number;
    pointsDiff: number;
  }[];
};

export type LeaderboardDTO = {
  rankedPlayers: (PlayerSummary & { rank: number })[];
  unrankedPlayers: (PlayerSummary & { potentialRank: number })[];
};

const GAME_LIMIT_FOR_RANKED = 5;

async function getLeaderboardMap(): Promise<Map<string, PlayerSummary>> {
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
      games: [],
    });
    return leaderboardMap.get(name)!;
  }

  allGames.forEach((game) => {
    const winner = getPlayer(game.winner);
    const loser = getPlayer(game.loser);
    const { winnersNewElo, losersNewElo } = calculateELO(winner.elo, loser.elo);
    winner.games.push({
      time: game.time,
      result: "win",
      oponent: loser.name,
      eloAfterGame: winnersNewElo,
      pointsDiff: winnersNewElo - winner.elo,
    });
    loser.games.push({
      time: game.time,
      result: "loss",
      oponent: winner.name,
      eloAfterGame: losersNewElo,
      pointsDiff: losersNewElo - loser.elo,
    });
    winner.wins++;
    loser.loss++;
    winner.elo = winnersNewElo;
    loser.elo = losersNewElo;
  });

  return leaderboardMap;
}

export async function getPlayerSummary(
  name: string
): Promise<(PlayerSummary & { isRanked: boolean; rank?: number }) | undefined> {
  const leaderboardMap = await getLeaderboardMap();
  const player = leaderboardMap.get(name);
  if (!player) return undefined;

  const playerIsRanked = player.games.length >= GAME_LIMIT_FOR_RANKED;

  const playersWithHigherElo = Array.from(leaderboardMap.values()).reduce(
    (acc, otherPlayer) =>
      (acc += otherPlayer.games.length >= GAME_LIMIT_FOR_RANKED && otherPlayer.elo > player.elo ? 1 : 0),
    0
  );

  return {
    ...player,
    isRanked: player.games.length >= GAME_LIMIT_FOR_RANKED,
    rank: playerIsRanked ? playersWithHigherElo + 1 : undefined,
  };
}

export async function getLeaderboard(): Promise<LeaderboardDTO> {
  const leaderboardMap = await getLeaderboardMap();

  const rankedPlayers: LeaderboardDTO["rankedPlayers"] = Array.from(leaderboardMap.values())
    .sort((a, b) => b.elo - a.elo)
    .filter((player) => player.wins + player.loss >= GAME_LIMIT_FOR_RANKED)
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }));

  const unrankedPlayers: LeaderboardDTO["unrankedPlayers"] = Array.from(leaderboardMap.values())
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
