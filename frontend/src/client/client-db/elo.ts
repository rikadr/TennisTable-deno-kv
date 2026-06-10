import { Game } from "./event-store/projectors/games-projector";
import { Player } from "./event-store/projectors/players-projector";

export type PlayerWithElo = Player & { elo: number; totalGames: number };

export abstract class Elo {
  static readonly K = 32;
  static readonly DIVISOR = 400;
  static readonly INITIAL_ELO = 1_000;

  // Provisional rating: a player's unranked games are rated with an
  // inflated K-factor that decays linearly from PROVISIONAL_K_MAX on their
  // first game down to the standard K on the game that makes them ranked
  // (their gameLimitForRanked-th game). New players therefore converge
  // fast while every game between two ranked players is rated at the
  // standard K. Each player's rating change is computed with their OWN
  // K-factor, so a game between a provisional and an established player
  // is intentionally not zero-sum: the newcomer's rating moves a lot
  // while the established player is only exposed at standard K. The rule
  // applies to the entire event history, so all ratings are projected as
  // if it had always been in effect.
  static readonly PROVISIONAL_K_MAX = 100;

  /**
   * K-factor for a single game. `totalGames` includes the game being rated:
   * a player's first game is rated at PROVISIONAL_K_MAX, decaying linearly
   * to exactly the standard K on the game that makes the player ranked
   * (totalGames === gameLimitForRanked) and every game after.
   */
  static kFactor(totalGames: number, gameLimitForRanked?: number): number {
    if (gameLimitForRanked === undefined || gameLimitForRanked < 2) {
      return this.K;
    }
    const gamesUntilRanked = Math.min(Math.max(gameLimitForRanked - totalGames, 0), gameLimitForRanked - 1);
    return this.K + (this.PROVISIONAL_K_MAX - this.K) * (gamesUntilRanked / (gameLimitForRanked - 1));
  }

  /** Probability (0..1) that a player rated `playerElo` beats one rated `oponentElo` */
  static expectedScore(playerElo: number, oponentElo: number): number {
    return 1 / (1 + Math.pow(10, (oponentElo - playerElo) / this.DIVISOR));
  }

  static eloCalculator(
    games: Game[],
    players: Player[],
    onGameResult?: (map: Map<string, PlayerWithElo>, game: Game) => void,
    gameLimitForRanked?: number,
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
        gameLimitForRanked,
      );

      winner.elo = winnersNewElo;
      loser.elo = losersNewElo;

      onGameResult && onGameResult(playerMap, game);
    });
    return playerMap;
  }

  static calculateELO(
    winnersElo: number,
    losersElo: number,
    winnersGames: number = 0,
    losersGames: number = 0,
    gameLimitForRanked?: number,
  ) {
    // Calculate the expected scores for both players
    const expectedScoreWinner = this.expectedScore(winnersElo, losersElo);
    const expectedScoreLoser = this.expectedScore(losersElo, winnersElo);

    const winnersNewElo = winnersElo + this.kFactor(winnersGames, gameLimitForRanked) * (1 - expectedScoreWinner);
    const losersNewElo = losersElo + this.kFactor(losersGames, gameLimitForRanked) * (0 - expectedScoreLoser);

    return {
      winnersNewElo,
      losersNewElo,
    };
  }
}
