import { Player, Game, ClientDbDTO } from "./types";

export class PVP {
  private players: Player[] = [];
  private games: Game[] = [];

  constructor(data: ClientDbDTO) {
    this.players = data.players;
    this.games = data.games;
  }

  compare(player1: string, player2: string): { player1: PlayerComparison; player2: PlayerComparison } {
    const relevantGames = this.games.filter(
      (game) =>
        // Player 1 wins
        (game.winner === player1 && game.loser === player2) ||
        // Player 2 wins
        (game.winner === player2 && game.loser === player1),
    );

    const player1Wins = relevantGames.filter((game) => game.winner === player1);
    const player2Wins = relevantGames.filter((game) => game.winner === player2);

    return {
      player1: { name: player1, wins: player1Wins.length, streak: this._getWinStreak(player1, relevantGames) },
      player2: { name: player2, wins: player2Wins.length, streak: this._getWinStreak(player2, relevantGames) },
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
  name: string;
  wins: number;
  streak: { longest: number; current: number };
};
