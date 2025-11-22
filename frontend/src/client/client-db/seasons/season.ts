import { Game } from "../event-store/projectors/games-projector";

export interface SeasonPlayerScore {
  playerId: string;
  seasonScore: number;
  matchups: Map<string, { bestPerformance: number; playedAt: number }>;
}

export class Season {
  readonly start: number;
  readonly end: number;
  readonly games: Game[] = [];
  private leaderboard: SeasonPlayerScore[] | undefined;
  private playerMatchups = new Map<string, Map<string, { bestPerformance: number; playedAt: number }>>();

  constructor(seasonTime: { start: number; end: number }) {
    this.start = seasonTime.start;
    this.end = seasonTime.end;
  }

  addGame(game: Game) {
    if (this.isValidGame(game) === false) {
      return;
    }
    this.games.push(game);
    this.leaderboard = undefined; // Invalidate cache
  }

  getLeaderboard(): SeasonPlayerScore[] {
    if (this.leaderboard) {
      return this.leaderboard;
    }

    for (const game of this.games) {
      const winnerPerformance = this.calculatePerformance(game, true);
      const loserPerformance = this.calculatePerformance(game, false);

      this.updateBestPerformance(game.winner, game.loser, winnerPerformance, game.playedAt);
      this.updateBestPerformance(game.loser, game.winner, loserPerformance, game.playedAt);
    }

    const seasonScores = new Map<string, SeasonPlayerScore>();
    for (const [playerId, matchups] of this.playerMatchups.entries()) {
      const seasonScore = Array.from(matchups.values()).reduce((sum, { bestPerformance }) => sum + bestPerformance, 0);
      seasonScores.set(playerId, { playerId, seasonScore, matchups });
    }

    this.leaderboard = Array.from(seasonScores.values()).sort((a, b) => b.seasonScore - a.seasonScore);
    return this.leaderboard;
  }

  private calculatePerformance(game: Game, isWinner: boolean): number {
    const setsWon = isWinner ? game.score!.setsWon.gameWinner : game.score!.setsWon.gameLoser;
    const totalSets = game.score!.setsWon.gameWinner + game.score!.setsWon.gameLoser;

    // 50 points from sets won percentage
    const setsScore = (setsWon / totalSets) * 50;

    // 50 points from balls won percentage (if available)
    let ballsScore = 0;
    if (game.score?.setPoints && game.score.setPoints.length > 0) {
      const { winnerBalls, loserBalls } = this.calculateTotalBalls(game.score.setPoints);
      const playerBalls = isWinner ? winnerBalls : loserBalls;
      const totalBalls = winnerBalls + loserBalls;
      ballsScore = (playerBalls / totalBalls) * 50;
    }

    return setsScore + ballsScore;
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

  /** Only games with set scores are valid */
  private isValidGame(game: Game): boolean {
    return game.score?.setsWon !== undefined;
  }
}
