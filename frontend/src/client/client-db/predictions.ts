import { Game } from "./event-store/projectors/games-projector";
import { gameToGame, pointToGame, setToGame } from "./future-elo-probability-lookups";
import { TennisTable } from "./tennis-table";
import { PairFraction } from "./expected-scores";
import { PairStats, ScoreStats } from "./pair-stats";
import { PlayerStrengths } from "./player-strengths";

export type Fraction = { fraction: number; confidence: number };

export type ConfidenceConfig = {
  additions: number;
  products: number;
  halfLifePoints: number;
  curveExponent: number;
};

export const GAME_CONFIDENCE_CONFIG: ConfidenceConfig = {
  additions: 3,
  products: 0.15,
  halfLifePoints: 28,
  curveExponent: 1,
};

export const SET_CONFIDENCE_CONFIG: ConfidenceConfig = {
  additions: 1.6,
  products: 0.02,
  halfLifePoints: 28,
  curveExponent: 1,
};

export const POINT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  additions: 0.2,
  products: 0,
  halfLifePoints: 34,
  curveExponent: 0.75,
};

export class Predictions {
  /**
   * `source` is the games to predict from, or shared strengths with their stats. Shared strengths let
   * a calculation for many reference times add or remove games instead of a new pass over all the
   * games, and start each fit from the fit before. The instance reads the stats when it needs them,
   * so do not change the shared stats while you use it.
   */
  constructor(parent: TennisTable, referenceTime?: number, source?: Game[] | PlayerStrengths) {
    this.parent = parent;
    this.referenceTime = referenceTime ?? Date.now();
    this.source = source ?? parent.games;
  }
  private parent: TennisTable;
  private referenceTime: number;
  private source: Game[] | PlayerStrengths;

  // ---------------------------------------------------------------------------
  // Pairwise stats
  // ---------------------------------------------------------------------------

  #pairStats: PairStats | undefined;

  private get pairStats(): PairStats {
    if (this.source instanceof PlayerStrengths) return this.source.pairStats;
    if (!this.#pairStats) {
      this.#pairStats = new PairStats(this.referenceTime, this.source);
    }
    return this.#pairStats;
  }

  /** Set of player IDs that each player has at least one game against */
  get adjacencyMap(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.pairStats.opponents;
  }

  /** All player IDs that appear in the game set */
  getAllPlayerIds(): string[] {
    return [...this.adjacencyMap.keys()];
  }

  /** Total games played by a player (in the game set this Predictions was built from) */
  getPlayerTotalGames(playerId: string): number {
    return this.pairStats.getTotalGames(playerId);
  }

  // ---------------------------------------------------------------------------
  // Direct stats lookups — O(1) replacement for per-game iteration
  // ---------------------------------------------------------------------------

  /** Get p1's accumulated stats against p2 (pre-computed, O(1) lookup) */
  getStats(p1: string, p2: string): ScoreStats {
    return this.pairStats.getStats(p1, p2, this.referenceTime);
  }

  /** cache[p1][p2] */
  #directCache = new Map<string, Map<string, Fraction>>();

  /**
   * The fraction from the games between p1 and p2 only, with the game, set and point levels merged.
   * {@link getPredictedFraction} uses all games.
   */
  getDirectFraction(p1: string, p2: string): Fraction {
    let opponents = this.#directCache.get(p1);
    if (!opponents) {
      opponents = new Map();
      this.#directCache.set(p1, opponents);
    }
    let fraction = opponents.get(p2);
    if (!fraction) {
      // Calculate each pair in one order, so the reverse is exactly the complement, also after rounding
      if (p1 > p2) {
        const reverse = this.getDirectFraction(p2, p1);
        fraction =
          reverse.confidence === 0 ? reverse : { fraction: 1 - reverse.fraction, confidence: reverse.confidence };
      } else {
        fraction = this.#calculateDirectFraction(p1, p2);
      }
      opponents.set(p2, fraction);
    }
    return fraction;
  }

  #calculateDirectFraction(p1: string, p2: string): Fraction {
    const p1Stats = this.getStats(p1, p2);
    const p2Stats = this.getStats(p2, p1);

    const predictions: Fraction[] = [];

    // Game-level
    const gameWins = p1Stats.ageAdjusted.games;
    const gameLosses = p2Stats.ageAdjusted.games;
    if (gameWins + gameLosses > 0) {
      predictions.push(
        Predictions.getWinFractionWithConfidence(gameWins, gameLosses, gameToGame, GAME_CONFIDENCE_CONFIG),
      );
    }

    // Set-level
    const setWins = p1Stats.ageAdjusted.sets;
    const setLosses = p2Stats.ageAdjusted.sets;
    if (setWins + setLosses > 0) {
      predictions.push(Predictions.getWinFractionWithConfidence(setWins, setLosses, setToGame, SET_CONFIDENCE_CONFIG));
    }

    // Point-level
    const pointWins = p1Stats.ageAdjusted.points;
    const pointLosses = p2Stats.ageAdjusted.points;
    if (pointWins + pointLosses > 0) {
      predictions.push(
        Predictions.getWinFractionWithConfidence(pointWins, pointLosses, pointToGame, POINT_CONFIDENCE_CONFIG),
      );
    }

    if (predictions.length === 0) return { fraction: 0, confidence: 0 };

    return Predictions.combinePrioritizedFractions(predictions);
  }

  /** Game-level stats for p1 vs p2 (raw + weighted totals and fraction) */
  getDirectGameStats(p1: string, p2: string) {
    const p1Stats = this.getStats(p1, p2);
    const p2Stats = this.getStats(p2, p1);
    const won = p1Stats.raw.games;
    const lost = p2Stats.raw.games;
    const weightedWins = p1Stats.ageAdjusted.games;
    const weightedLost = p2Stats.ageAdjusted.games;

    if (weightedWins + weightedLost === 0) {
      return { fraction: { fraction: 0, confidence: 0 }, won: 0, lost: 0, weightedWins: 0, weightedLost: 0 };
    }

    return {
      fraction: Predictions.getWinFractionWithConfidence(
        weightedWins,
        weightedLost,
        gameToGame,
        GAME_CONFIDENCE_CONFIG,
      ),
      won,
      lost,
      weightedWins,
      weightedLost,
    };
  }

  /** Set-level stats for p1 vs p2 */
  getDirectSetStats(p1: string, p2: string) {
    const p1Stats = this.getStats(p1, p2);
    const p2Stats = this.getStats(p2, p1);
    const won = p1Stats.raw.sets;
    const lost = p2Stats.raw.sets;
    const weightedWins = p1Stats.ageAdjusted.sets;
    const weightedLost = p2Stats.ageAdjusted.sets;

    if (weightedWins + weightedLost === 0) {
      return { fraction: { fraction: 0, confidence: 0 }, won: 0, lost: 0, weightedWins: 0, weightedLost: 0 };
    }

    return {
      fraction: Predictions.getWinFractionWithConfidence(weightedWins, weightedLost, setToGame, SET_CONFIDENCE_CONFIG),
      won,
      lost,
      weightedWins,
      weightedLost,
    };
  }

  /** Point-level stats for p1 vs p2 */
  getDirectPointStats(p1: string, p2: string) {
    const p1Stats = this.getStats(p1, p2);
    const p2Stats = this.getStats(p2, p1);
    const won = p1Stats.raw.points;
    const lost = p2Stats.raw.points;
    const weightedWins = p1Stats.ageAdjusted.points;
    const weightedLost = p2Stats.ageAdjusted.points;

    if (weightedWins + weightedLost === 0) {
      return { fraction: { fraction: 0, confidence: 0 }, won: 0, lost: 0, weightedWins: 0, weightedLost: 0 };
    }

    return {
      fraction: Predictions.getWinFractionWithConfidence(
        weightedWins,
        weightedLost,
        pointToGame,
        POINT_CONFIDENCE_CONFIG,
      ),
      won,
      lost,
      weightedWins,
      weightedLost,
    };
  }

  // ---------------------------------------------------------------------------
  // Prediction from all games
  // ---------------------------------------------------------------------------

  #strengths: PlayerStrengths | undefined;

  private get strengths(): PlayerStrengths {
    if (this.source instanceof PlayerStrengths) return this.source;
    this.#strengths ??= new PlayerStrengths(this.pairStats);
    return this.#strengths;
  }

  /** cache[p1][p2]. Null marks a pair with no prediction. Nested maps need no key string for each lookup */
  #predictedCache = new Map<string, Map<string, Fraction | null>>();

  /**
   * The chance that p1 wins against p2, from the strengths of all players fitted to all games.
   * Undefined when a player has no games. See {@link PlayerStrengths}.
   */
  getPredictedFraction(p1: string, p2: string): Fraction | undefined {
    let opponents = this.#predictedCache.get(p1);
    if (!opponents) {
      opponents = new Map();
      this.#predictedCache.set(p1, opponents);
    }
    const cached = opponents.get(p2);
    if (cached !== undefined) return cached ?? undefined;

    this.strengths.fit(this.referenceTime);
    const result = this.strengths.getPrediction(p1, p2);
    opponents.set(p2, result ?? null);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Expected score inputs
  // ---------------------------------------------------------------------------

  /**
   * The players in an expected score calculation: the active players with enough games to be ranked.
   * `includePlayerId` joins the calculation also when that player is unranked or retired.
   */
  getExpectedScorePlayerIds(includePlayerId?: string): string[] {
    return this.getAllPlayerIds().filter((id) => {
      if (id === includePlayerId) return true;
      const isActive = this.parent.eventStore.playersProjector.getPlayer(id)?.active === true;
      return this.getPlayerTotalGames(id) >= this.parent.client.gameLimitForRanked && isActive;
    });
  }

  /** The predicted fraction for each pair of the players. A pair with no prediction is left out. */
  getPairFractions(playerIds: string[]): PairFraction[] {
    const pairs: PairFraction[] = [];
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const predicted = this.getPredictedFraction(playerIds[i], playerIds[j]);
        if (predicted) pairs.push({ a: playerIds[i], b: playerIds[j], fraction: predicted.fraction });
      }
    }
    return pairs;
  }

  // ---------------------------------------------------------------------------
  // Cache invalidation
  // ---------------------------------------------------------------------------

  clearCache() {
    this.#pairStats = undefined;
    this.#strengths = undefined;
    this.#directCache.clear();
    this.#predictedCache.clear();
  }

  // ---------------------------------------------------------------------------
  // Static helpers (shared math, moved out of FutureElo instances)
  // ---------------------------------------------------------------------------

  static getWinFractionWithConfidence(
    wins: number,
    loss: number,
    probabilityLookup: number[],
    confidenceConfig: ConfidenceConfig,
  ): Fraction {
    const { additions, products, halfLifePoints, curveExponent } = confidenceConfig;

    const rawWinFraction = wins / (wins + loss);
    // The set and point lookups are not exactly symmetric. The average of the two directions is,
    // so the prediction for the other player is the complement.
    const expectedWinProbability =
      (Predictions.#lookUp(probabilityLookup, rawWinFraction) +
        1 -
        Predictions.#lookUp(probabilityLookup, loss / (wins + loss))) /
      2;

    const addition = wins + loss;
    const product = wins * loss;
    const confidencePoints = addition * additions + product * products;
    const confidence = 1 - Math.pow(2, -Math.pow(confidencePoints / halfLifePoints, curveExponent));

    return { fraction: expectedWinProbability, confidence };
  }

  /** The lookup value at this fraction, interpolated between the entries for each whole percent */
  static #lookUp(probabilityLookup: number[], fraction: number): number {
    const exactIndex = fraction * 100;
    const lowerIndex = Math.floor(exactIndex);
    const upperIndex = Math.ceil(exactIndex);

    if (lowerIndex === upperIndex || upperIndex > 100) {
      const index = Math.min(Math.max(Math.round(exactIndex), 0), 100);
      return probabilityLookup[index];
    }
    const lowerValue = probabilityLookup[lowerIndex];
    const upperValue = probabilityLookup[upperIndex];
    return lowerValue + (upperValue - lowerValue) * (exactIndex - lowerIndex);
  }

  static combinePrioritizedFractions(fractions: (Fraction | undefined)[]): Fraction {
    let weightedFractionSum = 0;
    let weightedConfidenceSum = 0;
    let totalWeight = 0;
    let remainingSpace = 1.0;

    for (const item of fractions) {
      if (item === undefined || remainingSpace <= 0) continue;

      const contributionWeight = item.confidence * remainingSpace;
      weightedFractionSum += item.fraction * contributionWeight;
      weightedConfidenceSum += item.confidence * contributionWeight;
      totalWeight += contributionWeight;
      remainingSpace -= contributionWeight;
    }

    if (totalWeight === 0) return { fraction: 0, confidence: 0 };

    return {
      fraction: weightedFractionSum / totalWeight,
      confidence: weightedConfidenceSum / totalWeight,
    };
  }
}
