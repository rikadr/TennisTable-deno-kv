import { Game } from "./event-store/reducers/games-projector";
import { Player } from "./event-store/reducers/players-projector";

type PlayerWithElo = Player & { elo: number; totalGames: number };

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

      const { winnersNewElo, losersNewElo } = this.calculateELO(
        winner.elo,
        loser.elo,
        winner.totalGames,
        loser.totalGames,
      );
      const pointsWon = winnersNewElo - winner.elo;

      winner.elo = winnersNewElo;
      loser.elo = losersNewElo;

      onGameResult && onGameResult(playerMap, game, pointsWon);
    });
    return playerMap;
  }

  static calculateELO(winnersElo: number, losersElo: number, winnersGames: number = 0, losersGames: number = 0) {
    // Calculate the expected scores for both players
    const expectedScoreWinner = 1 / (1 + Math.pow(10, (losersElo - winnersElo) / this.DIVISOR));
    const expectedScoreLoser = 1 / (1 + Math.pow(10, (winnersElo - losersElo) / this.DIVISOR));

    const winnersNewElo = winnersElo + Elo.getK(winnersGames) * (1 - expectedScoreWinner);
    const losersNewElo = losersElo + Elo.getK(losersGames) * (0 - expectedScoreLoser);

    return {
      winnersNewElo,
      losersNewElo,
    };
  }

  private static getK(games: number = 0) {
    const kDegradeThreshold = 200;
    const lowestK = 10;

    if (games < kDegradeThreshold) {
      return Elo.K;
    } else {
      return Math.min(lowestK, Elo.K * (kDegradeThreshold / games));
    }
  }
}
