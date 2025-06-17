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

  clearCaches() {
    this._leaderBoardCache = undefined;
    this._leaderBoardMapCache = undefined;
    this._playerSummaryCache = new Map();
    this._playerComparisonCache = new Map();
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
      .filter((player) => player.games.length >= this.parent.client.gameLimitForRanked)
      .sort((a, b) => b.elo - a.elo)
      .map((player, index) => ({
        ...player,
        rank: index + 1,
      }));

    const unrankedPlayers: LeaderboardDTO["unrankedPlayers"] = Array.from(leaderboardMap.values())
      .filter((player) => player.games.length < this.parent.client.gameLimitForRanked)
      .sort((a, b) => b.elo - a.elo);

    return {
      rankedPlayers,
      unrankedPlayers,
    };
  }

  getPlayerSummary(id: string) {
    if (this._playerSummaryCache.has(id)) {
      return this._playerSummaryCache.get(id)!;
    }

    const playerSummary = this._getPlayerSummary(id);
    if (playerSummary) {
      this._playerSummaryCache.set(id, playerSummary);
    }

    return playerSummary;
  }

  private _getPlayerSummary(id: string):
    | PlayerSummary & {
        isRanked: boolean;
        rank?: number;
        streaks?: { longestWin: number; longestLose: number };
        pointsDistrubution: { oponentId: string; points: number }[];
        gamesDistribution: { oponentId: string; games: number }[];
      } {
    const leaderboardMap = this.getCachedLeaderboardMap();

    const player = leaderboardMap.get(id);
    if (!player)
      return {
        id,
        elo: Elo.INITIAL_ELO,
        wins: 0,
        loss: 0,
        games: [],
        name: this.parent.playerName(id),
        gamesDistribution: [],
        pointsDistrubution: [],
        isRanked: false,
      };

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

    const playerIsRanked = player.games.length >= this.parent.client.gameLimitForRanked;

    const playersWithHigherElo = Array.from(leaderboardMap.values()).reduce(
      (acc, otherPlayer) =>
        (acc +=
          otherPlayer.games.length >= this.parent.client.gameLimitForRanked && otherPlayer.elo > player.elo ? 1 : 0),
      0,
    );

    // Points distrubution

    const pointsMap: Record<string, number> = {};
    for (const game of player.games) {
      pointsMap[game.oponent!] = (pointsMap[game.oponent!] || 0) + game.pointsDiff;
    }

    const pointsDistrubution = Object.keys(pointsMap)
      .map((oponentId) => ({ oponentId, points: pointsMap[oponentId] }))
      .sort((a, b) => b.points - a.points);

    // Games distrubution
    const gamesMap: Record<string, number> = {};
    for (const game of player.games) {
      gamesMap[game.oponent!] = (gamesMap[game.oponent!] || 0) + 1;
    }

    const gamesDistribution = Object.keys(gamesMap)
      .map((oponentId) => ({ oponentId, games: gamesMap[oponentId] }))
      .sort((a, b) => b.games - a.games);

    return {
      ...player,
      isRanked: player.games.length >= this.parent.client.gameLimitForRanked,
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
          graphData.push({ ...graphEntry, time: game.playedAt });
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

    const getPlayer = (id: string): PlayerSummary => {
      const player = leaderboardMap.get(id);
      if (player) return player;
      leaderboardMap.set(id, {
        id,
        name: this.parent.playerName(id),
        elo: Elo.INITIAL_ELO,
        wins: 0,
        loss: 0,
        games: [],
      });
      return leaderboardMap.get(id)!;
    };

    Elo.eloCalculator(
      [...this.parent.games, ...this.parent.futureElo.predictedGames],
      this.parent.players,
      (map, game, pointsWon) => {
        const winner = getPlayer(game.winner);
        const loser = getPlayer(game.loser);
        const winnersNewElo = map.get(game.winner)!.elo;
        const losersNewElo = map.get(game.loser)!.elo;

        winner.games.push({
          time: game.playedAt,
          result: "win",
          oponent: loser.id,
          eloAfterGame: winnersNewElo,
          pointsDiff: pointsWon,
          score: game.score,
        });
        loser.games.push({
          time: game.playedAt,
          result: "loss",
          oponent: winner.id,
          eloAfterGame: losersNewElo,
          pointsDiff: -pointsWon,
          score: game.score,
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
