import { Game, Player } from "./types";

type PlayerWithElo = Player & { elo: number };

export abstract class Elo {
  static readonly K = 32;
  static readonly DIVISOR = 400;
  static readonly INITIAL_ELO = 1_000;
  static readonly GAME_LIMIT_FOR_RANKED = 5;

  static eloCalculator(
    games: Game[],
    players: Player[],
    onGameResult?: (map: Map<string, PlayerWithElo>, game: Game, pointsWon: number) => void,
  ): Map<string, PlayerWithElo> {
    const playerMap = new Map<string, PlayerWithElo>(
      players.map((player) => [player.name, { ...player, elo: this.INITIAL_ELO }]),
    );

    games.forEach((game) => {
      const winner = playerMap.get(game.winner);
      const loser = playerMap.get(game.loser);
      if (!winner || !loser) {
        // Only games with both players existing in the player list will counted
        return;
      }
      const { winnersNewElo, losersNewElo } = this.calculateELO(winner.elo, loser.elo);
      const pointsWon = winnersNewElo - winner.elo;

      winner.elo = winnersNewElo;
      loser.elo = losersNewElo;

      onGameResult && onGameResult(playerMap, game, pointsWon);
    });
    return playerMap;
  }

  static calculateELO(winnersElo: number, losersElo: number) {
    // Calculate the expected scores for both players
    const expectedScoreWinner = 1 / (1 + Math.pow(10, (losersElo - winnersElo) / this.DIVISOR));
    const expectedScoreLoser = 1 / (1 + Math.pow(10, (winnersElo - losersElo) / this.DIVISOR));

    const winnersNewElo = winnersElo + this.K * (1 - expectedScoreWinner);
    const losersNewElo = losersElo + this.K * (0 - expectedScoreLoser);

    return {
      winnersNewElo,
      losersNewElo,
    };
  }
}
