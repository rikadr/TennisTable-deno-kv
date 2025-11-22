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
      const { winnerPoints, loserPoints } = this.calculateTotalPoints(game.score!.setPoints!);
      const totalPoints = winnerPoints + loserPoints;

      const winnerPerformance = (winnerPoints / totalPoints) * 100;
      const loserPerformance = (loserPoints / totalPoints) * 100;

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

  private calculateTotalPoints(setPoints: { gameWinner: number; gameLoser: number }[]): {
    winnerPoints: number;
    loserPoints: number;
  } {
    return setPoints.reduce(
      (acc, set) => {
        acc.winnerPoints += set.gameWinner;
        acc.loserPoints += set.gameLoser;
        return acc;
      },
      { winnerPoints: 0, loserPoints: 0 },
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

  /** Only games with at least 2 sets with full individual set scoring are valid */
  private isValidGame(game: Game): boolean {
    if (!game.score?.setPoints) return false;
    if (game.score.setPoints.length < 3) return false;
    return true;
  }
}
