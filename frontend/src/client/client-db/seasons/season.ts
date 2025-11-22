import { Game } from "../event-store/projectors/games-projector";

export interface SeasonPlayerScore {
  playerId: string;
  seasonScore: number;
  matchups: Map<string, { bestPerformance: number; playedAt: number }>;
  totalGames: number;
}

export class Season {
  readonly start: number;
  readonly end: number;
  readonly games: Game[] = [];
  private leaderboard: SeasonPlayerScore[] | undefined;
  private playerMatchups = new Map<string, Map<string, { bestPerformance: number; playedAt: number }>>();
  private playerGameCounts = new Map<string, number>();

  constructor(seasonTime: { start: number; end: number }) {
    this.start = seasonTime.start;
    this.end = seasonTime.end;
  }

  addGame(game: Game) {
    this.games.push(game);
    this.leaderboard = undefined; // Invalidate cache
  }

  getLeaderboard(): SeasonPlayerScore[] {
    if (this.leaderboard) {
      return this.leaderboard;
    }

    // Reset game counts
    this.playerGameCounts.clear();

    for (const game of this.games) {
      const winnerPerformance = this.calculatePerformance(game, true);
      const loserPerformance = this.calculatePerformance(game, false);

      this.updateBestPerformance(game.winner, game.loser, winnerPerformance, game.playedAt);
      this.updateBestPerformance(game.loser, game.winner, loserPerformance, game.playedAt);

      // Count total games per player
      this.playerGameCounts.set(game.winner, (this.playerGameCounts.get(game.winner) || 0) + 1);
      this.playerGameCounts.set(game.loser, (this.playerGameCounts.get(game.loser) || 0) + 1);
    }

    const seasonScores = new Map<string, SeasonPlayerScore>();
    for (const [playerId, matchups] of this.playerMatchups.entries()) {
      const seasonScore = Array.from(matchups.values()).reduce((sum, { bestPerformance }) => sum + bestPerformance, 0);
      const totalGames = this.playerGameCounts.get(playerId) || 0;
      seasonScores.set(playerId, { playerId, seasonScore, matchups, totalGames });
    }

    this.leaderboard = Array.from(seasonScores.values()).sort((a, b) => {
      // Primary sort: by season score (descending)
      if (b.seasonScore !== a.seasonScore) {
        return b.seasonScore - a.seasonScore;
      }
      // First tiebreaker: fewer pairings = higher rank (ascending)
      if (a.matchups.size !== b.matchups.size) {
        return a.matchups.size - b.matchups.size;
      }
      // Second tiebreaker: more total games = higher rank (descending)
      return b.totalGames - a.totalGames;
    });

    return this.leaderboard;
  }

  private calculatePerformance(game: Game, isWinner: boolean): number {
    // Win performance: 100 for winner, 0 for loser
    const winPerformance = isWinner ? 100 : 0;

    // Sets performance: percentage of sets won (0-100)
    let setsPerformance = 0;
    if (game.score?.setsWon) {
      const setsWon = isWinner ? game.score.setsWon.gameWinner : game.score.setsWon.gameLoser;
      const totalSets = game.score.setsWon.gameWinner + game.score.setsWon.gameLoser;
      setsPerformance = (setsWon / totalSets) * 100;
    }

    // Balls performance: percentage of balls won (0-100)
    let ballsPerformance = 0;
    if (game.score?.setPoints && game.score.setPoints.length > 0) {
      const { winnerBalls, loserBalls } = this.calculateTotalBalls(game.score.setPoints);
      const playerBalls = isWinner ? winnerBalls : loserBalls;
      const totalBalls = winnerBalls + loserBalls;
      ballsPerformance = (playerBalls / totalBalls) * 100;
    }

    // Average the three components
    return (winPerformance + setsPerformance + ballsPerformance) / 3;
  }

  private calculateTotalBalls(setPoints: { gameWinner: number; gameLoser: number }[]): {
    winnerBalls: number;
    loserBalls: number;
  } {
    return setPoints.reduce(
      (acc, set) => {
        acc.winnerBalls += set.gameWinner;
        acc.loserBalls += set.gameLoser;
        return acc;
      },
      { winnerBalls: 0, loserBalls: 0 },
    );
  }

  private updateBestPerformance(playerId: string, opponentId: string, performance: number, playedAt: number) {
    if (!this.playerMatchups.has(playerId)) {
      this.playerMatchups.set(playerId, new Map());
    }
    const matchups = this.playerMatchups.get(playerId)!;
    const currentBest = matchups.get(opponentId)?.bestPerformance ?? -1;

    if (performance > currentBest) {
      matchups.set(opponentId, { bestPerformance: performance, playedAt });
    }
  }
}
