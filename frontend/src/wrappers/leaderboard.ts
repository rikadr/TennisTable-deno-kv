import { Elo } from "./elo";
import { ClientDbDTO, Game, LeaderboardDTO, Player, PlayerComparison, PlayerSummary } from "./types";

export class Leaderboard {
  private players: Player[] = [];
  private games: Game[] = [];

  constructor(data: ClientDbDTO) {
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

  comparePlayers(players: string[]): PlayerComparison {
    const graphData: PlayerComparison["graphData"] = [];
    if (players.length === 0) {
      return {
        allPlayers: this.players.map((player) => player.name),
        graphData: [],
      };
    }

    const graphEntry: Record<string, number> = {};
    players.forEach((player) => (graphEntry[player] = Elo.INITIAL_ELO));
    graphData.push({ ...graphEntry });

    Elo.eloCalculator(this.games, this.players, (map, game) => {
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
      allPlayers: this.players.map((p) => p.name).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    };
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
        farmerGames: [],
        farmerScore: 0,
      });
      return leaderboardMap.get(name)!;
    }

    Elo.eloCalculator(this.games, this.players, (map, game, pointsWon) => {
      const winner = getPlayer(game.winner);
      const loser = getPlayer(game.loser);
      const winnersNewElo = map.get(game.winner)!.elo;
      const losersNewElo = map.get(game.loser)!.elo;

      // Farming score

      // Winner
      if (winner.games.length > Elo.GAME_LIMIT_FOR_RANKED) {
        const EloDiff = winnersNewElo - losersNewElo;
        const isFarmed = EloDiff > FARMER_DIFF_THRESHOLD;
        winner.farmerGames.unshift(isFarmed);
        if (winner.farmerGames.length > FARMER_GAME_LIMIT) {
          winner.farmerGames.pop();
        }
      }
      winner.farmerScore = this._calculateFarmerScore(winner);

      // Loser
      if (loser.games.length > Elo.GAME_LIMIT_FOR_RANKED) {
        loser.farmerGames.unshift(false);
        if (loser.farmerGames.length > FARMER_GAME_LIMIT) {
          loser.farmerGames.pop();
        }
      }
      loser.farmerScore = this._calculateFarmerScore(loser);

      winner.games.push({
        time: game.time,
        result: "win",
        oponent: loser.name,
        eloAfterGame: winnersNewElo,
        pointsDiff: pointsWon,
        farmerScoreAfterGame: winner.farmerScore,
      });
      loser.games.push({
        time: game.time,
        result: "loss",
        oponent: winner.name,
        eloAfterGame: losersNewElo,
        pointsDiff: -pointsWon,
        farmerScoreAfterGame: loser.farmerScore,
      });

      winner.wins++;
      loser.loss++;

      winner.elo = winnersNewElo;
      loser.elo = losersNewElo;
    });

    return leaderboardMap;
  }

  private _calculateFarmerScore(player: PlayerSummary): number {
    const farmedGames = player.farmerGames.filter(Boolean).length;
    const exceedingFarmedGames = Math.max(farmedGames - ALLOWED_FARMER_GAMES, 0);
    return Math.round((exceedingFarmedGames / (FARMER_GAME_LIMIT - ALLOWED_FARMER_GAMES)) * 10);
  }
}

export const FARMER_DIFF_THRESHOLD = 100;
export const FARMER_GAME_LIMIT = 13;
export const ALLOWED_FARMER_GAMES = 3;
