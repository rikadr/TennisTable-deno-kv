import { Elo } from "./elo";
import { ClientDbDTO, Game, LeaderboardDTO, Player, PlayerSummary } from "./types";

export class Leaderboard {
  private players: Player[] = [];
  private games: Game[] = [];

  constructor(data: ClientDbDTO) {
    console.log("Leaderboard constructor");

    this.players = data.players;
    this.games = data.games;
  }

  getLeaderboard(): LeaderboardDTO {
    const leaderboardMap = this._getLeaderboardMap();

    const rankedPlayers: LeaderboardDTO["rankedPlayers"] = Array.from(leaderboardMap.values())
      .sort((a, b) => b.elo - a.elo)
      .filter((player) => player.wins + player.loss >= Elo.GAME_LIMIT_FOR_RANKED)
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
      .filter((player) => player.wins + player.loss < Elo.GAME_LIMIT_FOR_RANKED);

    return {
      rankedPlayers,
      unrankedPlayers,
    };
  }

  getPlayerSummary(name: string):
    | (PlayerSummary & {
        isRanked: boolean;
        rank?: number;
        streaks?: { longestWin: number; longestLose: number };
      })
    | undefined {
    const leaderboardMap = this._getLeaderboardMap();

    const player = leaderboardMap.get(name);
    if (!player) return undefined;

    const streaks = { longestWin: 0, longestLose: 0 };
    let winStreak = 0;
    let loseStreak = 0;
    player.games.forEach((game) => {
      if (game.result === "win") {
        winStreak += 1;
        loseStreak = 0;
        streaks.longestWin = Math.max(streaks.longestWin, winStreak);
      } else {
        winStreak = 0;
        loseStreak += 1;
        streaks.longestLose = Math.max(streaks.longestLose, loseStreak);
      }
    });

    const playerIsRanked = player.games.length >= Elo.GAME_LIMIT_FOR_RANKED;

    const playersWithHigherElo = Array.from(leaderboardMap.values()).reduce(
      (acc, otherPlayer) =>
        (acc += otherPlayer.games.length >= Elo.GAME_LIMIT_FOR_RANKED && otherPlayer.elo > player.elo ? 1 : 0),
      0,
    );

    return {
      ...player,
      isRanked: player.games.length >= Elo.GAME_LIMIT_FOR_RANKED,
      rank: playerIsRanked ? playersWithHigherElo + 1 : undefined,
      streaks,
    };
  }

  private _getLeaderboardMap(): Map<string, PlayerSummary> {
    console.log("_getLeaderboardMap");

    const leaderboardMap = new Map<string, PlayerSummary>();

    function getPlayer(name: string): PlayerSummary {
      const player = leaderboardMap.get(name);
      if (player) return player;
      leaderboardMap.set(name, {
        name,
        elo: Elo.INITIAL_ELO,
        wins: 0,
        loss: 0,
        games: [],
      });
      return leaderboardMap.get(name)!;
    }

    Elo.eloCalculator(this.games, this.players, (map, game, pointsWon) => {
      const winner = getPlayer(game.winner);
      const loser = getPlayer(game.loser);
      const winnersNewElo = map.get(game.winner)!.elo;
      const losersNewElo = map.get(game.loser)!.elo;
      winner.games.push({
        time: game.time,
        result: "win",
        oponent: loser.name,
        eloAfterGame: winnersNewElo,
        pointsDiff: pointsWon,
      });
      loser.games.push({
        time: game.time,
        result: "loss",
        oponent: winner.name,
        eloAfterGame: losersNewElo,
        pointsDiff: -pointsWon,
      });
      winner.wins++;
      loser.loss++;
      winner.elo = winnersNewElo;
      loser.elo = losersNewElo;
    });

    return leaderboardMap;
  }
}
