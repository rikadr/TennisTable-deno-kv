import { Game } from "./event-store/projectors/games-projector";
import { TennisTable } from "./tennis-table";
import { PlayerSummary } from "./types";

export class PVP {
  private parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }
  compare(
    player1: string,
    player2: string,
  ): { player1: PlayerComparison; player2: PlayerComparison; games: PlayerSummary["games"] } {
    const relevantGames = [...this.parent.games, ...this.parent.futureElo.predictedGames].filter(
      (game) =>
        // Player 1 wins
        (game.winner === player1 && game.loser === player2) ||
        // Player 2 wins
        (game.winner === player2 && game.loser === player1),
    );

    const player1Wins = relevantGames.filter((game) => game.winner === player1);
    const player2Wins = relevantGames.filter((game) => game.winner === player2);

    const player1Summary = this.parent.leaderboard.getPlayerSummary(player1);
    const player2Summary = this.parent.leaderboard.getPlayerSummary(player2);

    const relevantSummaryGames = player1Summary?.games.filter((game) => game.oponent === player2);
    const points = { p1: { gained: 0, lost: 0 }, p2: { gained: 0, lost: 0 } };

    relevantSummaryGames?.forEach((game) => {
      if (game.result === "win") {
        points.p1.gained += game.pointsDiff;
        points.p2.lost += game.pointsDiff;
      } else {
        points.p1.lost -= game.pointsDiff;
        points.p2.gained -= game.pointsDiff;
      }
    });

    return {
      player1: {
        playerId: player1,
        name: this.parent.playerName(player1),
        wins: player1Wins.length,
        streak: this._getWinStreak(player1, relevantGames),
        points: { currentElo: player1Summary?.elo || 0, ...points.p1 },
      },
      player2: {
        playerId: player2,
        name: this.parent.playerName(player2),
        wins: player2Wins.length,
        streak: this._getWinStreak(player2, relevantGames),
        points: { currentElo: player2Summary?.elo || 0, ...points.p2 },
      },
      games: relevantSummaryGames || [],
    };
  }

  private _getWinStreak(player: string, games: Game[]): { longest: number; current: number } {
    let longestStreak = 0;
    let currentStreak = 0;
    games.forEach((game) => {
      if (game.winner === player) {
        currentStreak++;
        longestStreak = Math.max(currentStreak, longestStreak);
      } else {
        currentStreak = 0;
      }
    });
    return { longest: longestStreak, current: currentStreak };
  }
}

type PlayerComparison = {
  playerId: string;
  name: string;
  wins: number;
  streak: { longest: number; current: number };
  points: { currentElo: number; gained: number; lost: number };
};
