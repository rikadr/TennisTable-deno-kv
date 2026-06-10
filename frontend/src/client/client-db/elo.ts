import { Game } from "./event-store/projectors/games-projector";
import { Player } from "./event-store/projectors/players-projector";

export type PlayerWithElo = Player & { elo: number; totalGames: number };

export abstract class Elo {
  static readonly K = 32;
  static readonly DIVISOR = 400;
  static readonly INITIAL_ELO = 1_000;

  // Provisional rating: a player's first games are rated with an inflated,
  // decaying K-factor so newcomers converge on their real strength in about
  // a dozen games instead of 30-50. Each player's rating change is computed
  // with their OWN K-factor, so a game between a provisional and an
  // established player is intentionally not zero-sum: the newcomer's rating
  // moves a lot while the established player is only exposed at standard K.
  static readonly PROVISIONAL_K_MAX = 80;
  static readonly PROVISIONAL_K_DECAY = 4; // K reduction per game played
  // Games played before this moment are rated with the fixed, zero-sum K
  // for both players, so replaying the event log does not rewrite results
  // from before the provisional system was introduced.
  static readonly PROVISIONAL_EPOCH = Date.UTC(2026, 5, 11); // 2026-06-11

  /**
   * K-factor for a single game. `totalGames` includes the game being rated:
   * a player's first game is rated at PROVISIONAL_K_MAX, decaying linearly
   * by PROVISIONAL_K_DECAY per game until it reaches the standard K
   * (after (80-32)/4 = 12 games with the current constants).
   */
  static kFactor(totalGames: number, playedAt?: number): number {
    if (playedAt === undefined || playedAt < this.PROVISIONAL_EPOCH) {
      return this.K;
    }
    const provisionalK = this.PROVISIONAL_K_MAX - this.PROVISIONAL_K_DECAY * Math.max(totalGames - 1, 0);
    return Math.max(this.K, Math.min(this.PROVISIONAL_K_MAX, provisionalK));
  }

  /** Probability (0..1) that a player rated `playerElo` beats one rated `oponentElo` */
  static expectedScore(playerElo: number, oponentElo: number): number {
    return 1 / (1 + Math.pow(10, (oponentElo - playerElo) / this.DIVISOR));
  }

  static eloCalculator(
    games: Game[],
    players: Player[],
    onGameResult?: (map: Map<string, PlayerWithElo>, game: Game) => void,
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
        game.playedAt,
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
    playedAt?: number,
  ) {
    // Calculate the expected scores for both players
    const expectedScoreWinner = this.expectedScore(winnersElo, losersElo);
    const expectedScoreLoser = this.expectedScore(losersElo, winnersElo);

    const winnersNewElo = winnersElo + this.kFactor(winnersGames, playedAt) * (1 - expectedScoreWinner);
    const losersNewElo = losersElo + this.kFactor(losersGames, playedAt) * (0 - expectedScoreLoser);

    return {
      winnersNewElo,
      losersNewElo,
    };
  }
}
