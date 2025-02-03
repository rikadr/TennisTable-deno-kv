import { Elo } from "./elo";
import { TennisTable } from "./tennis-table";
import { LeaderboardDTO, PlayerComparison, PlayerSummary } from "./types";

export class Leaderboard {
  private parent: TennisTable;

  private _leaderBoardCache: ReturnType<typeof this._getLeaderboard> | undefined;
  private _leaderBoardMapCache: ReturnType<typeof this._getLeaderboardMap> | undefined;
  private _playerSummaryCache: Map<string, ReturnType<typeof this._getPlayerSummary>> = new Map();
  private _playerComparisonCache: Map<string, ReturnType<typeof this._comparePlayers>> = new Map();

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  getLeaderboard(): LeaderboardDTO {
    if (this._leaderBoardCache !== undefined) return this._leaderBoardCache;
    const leaderboard = this._getLeaderboard();
    this._leaderBoardCache = leaderboard;
    return leaderboard;
  }

  private _getLeaderboard(): LeaderboardDTO {
    const leaderboardMap = this.getCachedLeaderboardMap();

    const rankedPlayers: LeaderboardDTO["rankedPlayers"] = Array.from(leaderboardMap.values())
      .filter((player) => player.games.length >= Elo.GAME_LIMIT_FOR_RANKED)
      .sort((a, b) => b.elo - a.elo)
      .map((player, index) => ({
        ...player,
        rank: index + 1,
      }));

    const unrankedPlayers: LeaderboardDTO["unrankedPlayers"] = Array.from(leaderboardMap.values())
      .filter((player) => player.games.length < Elo.GAME_LIMIT_FOR_RANKED)
      .sort((a, b) => b.elo - a.elo);

    return {
      rankedPlayers,
      unrankedPlayers,
    };
  }

  getPlayerSummary(name: string) {
    if (this._playerSummaryCache.has(name)) {
      return this._playerSummaryCache.get(name)!;
    }

    const playerSummary = this._getPlayerSummary(name);
    if (playerSummary) {
      this._playerSummaryCache.set(name, playerSummary);
    }

    return playerSummary;
  }

  private _getPlayerSummary(name: string):
    | (PlayerSummary & {
        isRanked: boolean;
        rank?: number;
        streaks?: { longestWin: number; longestLose: number };
        pointsDistrubution: { name: string; points: number }[];
        gamesDistribution: { name: string; games: number }[];
      })
    | undefined {
    const leaderboardMap = this.getCachedLeaderboardMap();

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

    // Points distrubution

    const pointsMap: Record<string, number> = {};
    for (const game of player.games) {
      pointsMap[game.oponent] = (pointsMap[game.oponent] || 0) + game.pointsDiff;
    }

    const pointsDistrubution = Object.keys(pointsMap)
      .map((name) => ({ name, points: pointsMap[name] }))
      .sort((a, b) => b.points - a.points);

    // Games distrubution
    const gamesMap: Record<string, number> = {};
    for (const game of player.games) {
      gamesMap[game.oponent] = (gamesMap[game.oponent] || 0) + 1;
    }

    const gamesDistribution = Object.keys(gamesMap)
      .map((name) => ({ name, games: gamesMap[name] }))
      .sort((a, b) => b.games - a.games);

    return {
      ...player,
      isRanked: player.games.length >= Elo.GAME_LIMIT_FOR_RANKED,
      rank: playerIsRanked ? playersWithHigherElo + 1 : undefined,
      streaks,
      pointsDistrubution,
      gamesDistribution,
    };
  }

  comparePlayers(players: string[]) {
    const key = players.sort().join(",");
    if (this._playerComparisonCache.has(key)) {
      return this._playerComparisonCache.get(key)!;
    }

    const playerComparison = this._comparePlayers(players);
    this._playerComparisonCache.set(key, playerComparison);
    return playerComparison;
  }

  private _comparePlayers(players: string[]): PlayerComparison {
    const graphData: PlayerComparison["graphData"] = [];
    if (players.length === 0) {
      return {
        allPlayers: this.parent.players.map((player) => player.name),
        graphData: [],
      };
    }

    const graphEntry: Record<string, number> = {};
    players.forEach((player) => (graphEntry[player] = Elo.INITIAL_ELO));
    graphData.push({ ...graphEntry });

    Elo.eloCalculator(
      [...this.parent.games, ...this.parent.futureElo.predictedGames],
      this.parent.players,
      (map, game) => {
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
      },
    );

    return {
      graphData,
      allPlayers: this.parent.players.map((p) => p.name).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    };
  }
  getCachedLeaderboardMap() {
    if (this._leaderBoardMapCache !== undefined) return this._leaderBoardMapCache;
    const leaderboardMap = this._getLeaderboardMap();
    this._leaderBoardMapCache = leaderboardMap;
    return leaderboardMap;
  }

  private _getLeaderboardMap(): Map<string, PlayerSummary> {
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

    Elo.eloCalculator(
      [...this.parent.games, ...this.parent.futureElo.predictedGames],
      this.parent.players,
      (map, game, pointsWon) => {
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
      },
    );

    return leaderboardMap;
  }
}
