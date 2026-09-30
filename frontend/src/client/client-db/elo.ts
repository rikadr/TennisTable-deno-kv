import { Game } from "./event-store/projectors/games-projector";
import { Player } from "./event-store/projectors/players-projector";

export type PlayerWithElo = Player & { elo: number; totalGames: number };

export abstract class Elo {
  static readonly K = 32;
  static readonly DIVISOR = 400;
  static readonly INITIAL_ELO = 1_000;

  static eloCalculator(
    games: Game[],
    players: Player[],
    onGameResult?: (map: Map<string, PlayerWithElo>, game: Game, pointsWon: number) => void,
  ): Map<string, PlayerWithElo> {
    const playerMap = new Map<string, PlayerWithElo>(
      players.map((player) => [player.id, { ...player, elo: this.INITIAL_ELO, totalGames: 0 }]),
    );

    games.forEach((game) => {
      const winner = playerMap.get(game.winner);
      const loser = playerMap.get(game.loser);
      if (!winner || !loser) {
        // Only games with both players existing in the player list will counted
        return;
      }
      winner.totalGames++;
      loser.totalGames++;

      const { winnersNewElo, losersNewElo } = this.calculateELO(winner.elo, loser.elo);
      const pointsWon = winnersNewElo - winner.elo;

      winner.elo = winnersNewElo;
      loser.elo = losersNewElo;

      onGameResult && onGameResult(playerMap, game, pointsWon);
    });
    return playerMap;
  }

  /** The expected result of a game for a player: the probability of a win. */
  static expectedResult(score: number, opponentScore: number): number {
    return 1 / (1 + Math.pow(10, (opponentScore - score) / this.DIVISOR));
  }

  static calculateELO(winnersElo: number, losersElo: number) {
    // Calculate the expected scores for both players
    const expectedScoreWinner = this.expectedResult(winnersElo, losersElo);
    const expectedScoreLoser = this.expectedResult(losersElo, winnersElo);

    const winnersNewElo = winnersElo + Elo.K * (1 - expectedScoreWinner);
    const losersNewElo = losersElo + Elo.K * (0 - expectedScoreLoser);

    return {
      winnersNewElo,
      losersNewElo,
    };
  }
}
