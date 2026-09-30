import { Game } from "./event-store/projectors/games-projector";
import { gameToGame, pointToGame, setToGame } from "./future-elo-probability-lookups";
import { TennisTable } from "./tennis-table";
import { PairFraction } from "./expected-scores";

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

type ScoreStats = {
  raw: { games: number; sets: number; points: number };
  ageAdjusted: { games: number; sets: number; points: number };
};

/** map[playerA][playerB] = playerA's accumulated stats in all games against playerB */
type PairwiseStatsMap = Map<string, Map<string, ScoreStats>>;

export class Predictions {
  constructor(parent: TennisTable, referenceTime?: number, games?: Game[]) {
    this.parent = parent;
    this.referenceTime = referenceTime ?? Date.now();
    this.games = games ?? parent.games;
  }
  private parent: TennisTable;
  private referenceTime: number;
  private games: Game[];

  // ---------------------------------------------------------------------------
  // Pairwise stats — single pass over all games
  // ---------------------------------------------------------------------------

  #pairwiseStats: PairwiseStatsMap | undefined;

  private get pairwiseStats(): PairwiseStatsMap {
    if (!this.#pairwiseStats) {
      this.#pairwiseStats = this.#buildPairwiseStats();
    }
    return this.#pairwiseStats;
  }

  #buildPairwiseStats(): PairwiseStatsMap {
    const map: PairwiseStatsMap = new Map();
    const now = this.referenceTime;

    const ensureEntry = (a: string, b: string): ScoreStats => {
      if (!map.has(a)) map.set(a, new Map());
      const inner = map.get(a)!;
      if (!inner.has(b)) {
        inner.set(b, {
          raw: { games: 0, sets: 0, points: 0 },
          ageAdjusted: { games: 0, sets: 0, points: 0 },
        });
      }
      return inner.get(b)!;
    };

    for (const game of this.games) {
      const ageWeight = this.ageAdjustedWeight(1, game.playedAt, now);

      // Winner's side
      const winnerStats = ensureEntry(game.winner, game.loser);
      winnerStats.raw.games += 1;
      winnerStats.ageAdjusted.games += ageWeight;

      if (game.score) {
        winnerStats.raw.sets += game.score.setsWon.gameWinner;
        winnerStats.ageAdjusted.sets += game.score.setsWon.gameWinner * ageWeight;
      }
      if (game.score?.setPoints) {
        const pts = game.score.setPoints.reduce((sum, set) => sum + set.gameWinner, 0);
        winnerStats.raw.points += pts;
        winnerStats.ageAdjusted.points += pts * ageWeight;
      }

      // Loser's side (no game count increment — they lost this game)
      const loserStats = ensureEntry(game.loser, game.winner);

      if (game.score) {
        loserStats.raw.sets += game.score.setsWon.gameLoser;
        loserStats.ageAdjusted.sets += game.score.setsWon.gameLoser * ageWeight;
      }
      if (game.score?.setPoints) {
        const pts = game.score.setPoints.reduce((sum, set) => sum + set.gameLoser, 0);
        loserStats.raw.points += pts;
        loserStats.ageAdjusted.points += pts * ageWeight;
      }
    }

    return map;
  }

  // ---------------------------------------------------------------------------
  // Adjacency map — who has played whom
  // ---------------------------------------------------------------------------

  #adjacencyMap: Map<string, Set<string>> | undefined;

  /** Set of player IDs that each player has at least one game against */
  get adjacencyMap(): Map<string, Set<string>> {
    if (!this.#adjacencyMap) {
      this.#adjacencyMap = this.#buildAdjacencyMap();
    }
    return this.#adjacencyMap;
  }

  #buildAdjacencyMap(): Map<string, Set<string>> {
    const adj = new Map<string, Set<string>>();
    for (const game of this.games) {
      if (!adj.has(game.winner)) adj.set(game.winner, new Set());
      if (!adj.has(game.loser)) adj.set(game.loser, new Set());
      adj.get(game.winner)!.add(game.loser);
      adj.get(game.loser)!.add(game.winner);
    }
    return adj;
  }

  /** All player IDs that appear in the game set */
  getAllPlayerIds(): string[] {
    return [...this.adjacencyMap.keys()];
  }

  /** Total games played by a player (in the game set this Predictions was built from) */
  getPlayerTotalGames(playerId: string): number {
    const inner = this.pairwiseStats.get(playerId);
    if (!inner) return 0;
    let total = 0;
    for (const [opponentId, stats] of inner) {
      total += stats.raw.games; // games this player won
      total += this.pairwiseStats.get(opponentId)?.get(playerId)?.raw.games ?? 0; // games this player lost
    }
    return total;
  }

  /** Players who have played BOTH p1 and p2 — the only valid one-layer intermediaries */
  getCommonOpponents(p1: string, p2: string): string[] {
    const adj1 = this.adjacencyMap.get(p1);
    const adj2 = this.adjacencyMap.get(p2);
    if (!adj1 || !adj2) return [];

    const [smaller, larger] = adj1.size <= adj2.size ? [adj1, adj2] : [adj2, adj1];
    const result: string[] = [];
    for (const id of smaller) {
      if (larger.has(id) && id !== p1 && id !== p2) {
        result.push(id);
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Direct stats lookups — O(1) replacement for per-game iteration
  // ---------------------------------------------------------------------------

  private static readonly EMPTY_STATS: ScoreStats = {
    raw: { games: 0, sets: 0, points: 0 },
    ageAdjusted: { games: 0, sets: 0, points: 0 },
  };

  /** Get p1's accumulated stats against p2 (pre-computed, O(1) lookup) */
  getStats(p1: string, p2: string): ScoreStats {
    return this.pairwiseStats.get(p1)?.get(p2) ?? Predictions.EMPTY_STATS;
  }

  /** cache[p1][p2]. The two-layer prediction uses each direct fraction many times */
  #directCache = new Map<string, Map<string, Fraction>>();

  /**
   * Combined direct fraction (game+set+point levels merged) for p1 vs p2.
   * Equivalent to FutureElo.getDirectFraction but with zero game iteration.
   */
  getDirectFraction(p1: string, p2: string): Fraction {
    let opponents = this.#directCache.get(p1);
    if (!opponents) {
      opponents = new Map();
      this.#directCache.set(p1, opponents);
    }
    let fraction = opponents.get(p2);
    if (!fraction) {
      // Calculate each pair in one order, so the reverse is exactly the complement, also after rounding.
      // A chain of a link near 0 and a link near 1 makes a small difference much larger.
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
  // One-layer fraction (with adjacency pruning)
  // ---------------------------------------------------------------------------

  #oneLayerCache = new Map<string, Fraction>();

  private oneLayerCacheKey(p1: string, p2: string): string {
    return `${p1}|${p2}`;
  }

  getOneLayerFraction(p1: string, p2: string): Fraction {
    const key = this.oneLayerCacheKey(p1, p2);
    const cached = this.#oneLayerCache.get(key);
    if (cached) return cached;

    const intermediaries = this.getCommonOpponents(p1, p2);
    const fractions: Fraction[] = [];

    for (const mid of intermediaries) {
      const p1ToMid = this.getDirectFraction(p1, mid);
      const midToP2 = this.getDirectFraction(mid, p2);
      fractions.push(Predictions.linkFractions(p1ToMid, midToP2));
    }

    const result = Predictions.combineFractions(fractions);

    this.#oneLayerCache.set(key, result);
    this.#oneLayerCache.set(this.oneLayerCacheKey(p2, p1), {
      fraction: 1 - result.fraction,
      confidence: result.confidence,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // Two-layer fraction (with adjacency pruning)
  // ---------------------------------------------------------------------------

  #twoLayerCache = new Map<string, Fraction>();

  /**
   * The chains p1→a→b for each player b, with the first two links already linked. A prediction
   * for p1 against many players uses the same chains, so they are calculated once for each p1.
   */
  #chainsFrom = new Map<string, Map<string, { via: string[]; fractions: number[]; confidences: number[] }>>();

  #getChainsFrom(p1: string) {
    const known = this.#chainsFrom.get(p1);
    if (known) return known;

    const chains = new Map<string, { via: string[]; fractions: number[]; confidences: number[] }>();
    for (const a of this.adjacencyMap.get(p1) ?? []) {
      const p1ToA = this.getDirectFraction(p1, a);
      for (const b of this.adjacencyMap.get(a)!) {
        if (b === p1) continue;
        const link = Predictions.linkFractions(p1ToA, this.getDirectFraction(a, b));
        // A contradictory link has no confidence, so it adds nothing to the combined fraction
        if (link.confidence === 0) continue;
        let toB = chains.get(b);
        if (!toB) {
          toB = { via: [], fractions: [], confidences: [] };
          chains.set(b, toB);
        }
        toB.via.push(a);
        toB.fractions.push(link.fraction);
        toB.confidences.push(link.confidence);
      }
    }
    this.#chainsFrom.set(p1, chains);
    return chains;
  }

  /**
   * All chains p1→a→b→p2, where each player in the chain played the next one, combined with
   * {@link Predictions.combineFractions}. The chains p1→a→b→p2 and p1→b→a→p2 use different
   * games, so both count.
   */
  getTwoLayerFraction(p1: string, p2: string): Fraction {
    const key = `${p1}|${p2}`;
    const cached = this.#twoLayerCache.get(key);
    if (cached) return cached;

    const chains = this.#getChainsFrom(p1);
    let weightedFractionSum = 0;
    let weightedConfidenceSum = 0;
    let totalWeight = 0;
    for (const b of this.adjacencyMap.get(p2) ?? []) {
      if (b === p1) continue;
      const toB = chains.get(b);
      if (!toB) continue;
      const bToP2 = this.getDirectFraction(b, p2);
      for (let i = 0; i < toB.via.length; i++) {
        if (toB.via[i] === p2) continue;
        // No object for each chain. A contradictory chain has no confidence, so it adds nothing
        const fraction = Predictions.linkFractionValues(toB.fractions[i], bToP2.fraction);
        if (fraction === undefined) continue;
        const confidence = toB.confidences[i] * bToP2.confidence;
        weightedFractionSum += fraction * confidence;
        weightedConfidenceSum += confidence * confidence;
        totalWeight += confidence;
      }
    }

    const result =
      totalWeight === 0
        ? { fraction: 0, confidence: 0 }
        : { fraction: weightedFractionSum / totalWeight, confidence: weightedConfidenceSum / totalWeight };

    this.#twoLayerCache.set(key, result);
    this.#twoLayerCache.set(`${p2}|${p1}`, {
      fraction: 1 - result.fraction,
      confidence: result.confidence,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // Combined prediction (all three layers)
  // ---------------------------------------------------------------------------

  /** cache[p1][p2]. Null marks a pair with no prediction. Nested maps need no key string for each lookup */
  #predictedCache = new Map<string, Map<string, Fraction | null>>();

  getPredictedFraction(p1: string, p2: string): Fraction | undefined {
    let opponents = this.#predictedCache.get(p1);
    if (!opponents) {
      opponents = new Map();
      this.#predictedCache.set(p1, opponents);
    }
    const cached = opponents.get(p2);
    if (cached !== undefined) return cached ?? undefined;

    const direct = this.getDirectFraction(p1, p2);
    const oneLayer = this.getOneLayerFraction(p1, p2);
    const twoLayer = this.getTwoLayerFraction(p1, p2);

    const combined = Predictions.combinePrioritizedFractions([direct, oneLayer, twoLayer]);
    const result = combined.confidence === 0 ? undefined : combined;
    opponents.set(p2, result ?? null);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Expected score inputs
  // ---------------------------------------------------------------------------

  /** The players in an expected score calculation: the active players with enough games to be ranked. */
  getExpectedScorePlayerIds(includeUnrankedPlayerId?: string): string[] {
    return this.getAllPlayerIds().filter((id) => {
      const isActive = this.parent.eventStore.playersProjector.getPlayer(id)?.active === true;
      // The explicitly included player joins the calculation regardless of game count
      if (id === includeUnrankedPlayerId) return isActive;
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
    this.#pairwiseStats = undefined;
    this.#adjacencyMap = undefined;
    this.#directCache.clear();
    this.#oneLayerCache.clear();
    this.#twoLayerCache.clear();
    this.#chainsFrom.clear();
    this.#predictedCache.clear();
  }

  // ---------------------------------------------------------------------------
  // Static helpers (shared math, moved out of FutureElo instances)
  // ---------------------------------------------------------------------------

  private ageAdjustedWeight(value: number, gameTime: number, referenceTime: number): number {
    const ageInDays = Math.max(referenceTime - gameTime, 0) / (24 * 60 * 60 * 1000);
    const halfLife = 120;
    return value * Math.pow(2, -ageInDays / halfLife);
  }

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

  static combineFractions(fractions: (Fraction | undefined)[]): Fraction {
    let weightedFractionSum = 0;
    let weightedConfidenceSum = 0;
    let totalWeight = 0;

    for (const item of fractions) {
      if (item === undefined) continue;
      weightedFractionSum += item.fraction * item.confidence;
      weightedConfidenceSum += item.confidence * item.confidence;
      totalWeight += item.confidence;
    }

    if (totalWeight === 0) return { fraction: 0, confidence: 0 };

    return {
      fraction: weightedFractionSum / totalWeight,
      confidence: weightedConfidenceSum / totalWeight,
    };
  }

  static linkFractions(fraction1: Fraction, fraction2: Fraction): Fraction {
    const fraction = Predictions.linkFractionValues(fraction1.fraction, fraction2.fraction);
    // A link of 0 and a link of 1 contradict each other, so the chain gives no information
    if (fraction === undefined) return { fraction: 0.5, confidence: 0 };
    return { fraction, confidence: fraction1.confidence * fraction2.confidence };
  }

  /** The Bradley-Terry link of two fractions. Undefined when a link of 0 meets a link of 1 */
  static linkFractionValues(fraction1: number, fraction2: number): number | undefined {
    const numerator = fraction1 * fraction2;
    const denominator = numerator + (1 - fraction1) * (1 - fraction2);
    return denominator === 0 ? undefined : numerator / denominator;
  }
}
