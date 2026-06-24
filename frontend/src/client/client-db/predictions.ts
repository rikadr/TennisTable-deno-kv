import { Game } from "./event-store/projectors/games-projector";
import { gameToGame, pointToGame, setToGame } from "./future-elo-probability-lookups";
import { newId } from "../../common/nani-id";
import { TennisTable } from "./tennis-table";

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

  /**
   * Combined direct fraction (game+set+point levels merged) for p1 vs p2.
   * Equivalent to FutureElo.getDirectFraction but with zero game iteration.
   */
  getDirectFraction(p1: string, p2: string): Fraction {
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

  getTwoLayerFraction(p1: string, p2: string): Fraction {
    const key = `${p1}|${p2}`;
    const cached = this.#twoLayerCache.get(key);
    if (cached) return cached;

    const adjP1 = this.adjacencyMap.get(p1);
    const adjP2 = this.adjacencyMap.get(p2);
    if (!adjP1 || !adjP2) {
      const zero = { fraction: 0, confidence: 0 };
      this.#twoLayerCache.set(key, zero);
      return zero;
    }

    // Collect all candidate intermediaries: players adjacent to p1 OR p2
    // (excluding p1 and p2 themselves). Each candidate can serve as int1 or int2.
    const candidates: string[] = [];
    const isAdjP1 = new Set<string>();
    const isAdjP2 = new Set<string>();
    const candidateSet = new Set<string>();

    for (const id of adjP1) {
      if (id === p2) continue;
      if (!candidateSet.has(id)) {
        candidateSet.add(id);
        candidates.push(id);
      }
      isAdjP1.add(id);
    }
    for (const id of adjP2) {
      if (id === p1) continue;
      if (!candidateSet.has(id)) {
        candidateSet.add(id);
        candidates.push(id);
      }
      isAdjP2.add(id);
    }

    const fractions: Fraction[] = [];

    // Iterate unique unordered pairs (i < j) of candidates.
    // A valid chain p1→a→b→p2 needs: a adj p1, a adj b, b adj p2.
    // Since {a,b} and {b,a} yield equivalent results under the
    // Bradley-Terry model, we try both orientations of each pair
    // but only where the adjacency constraints are met.
    for (let i = 0; i < candidates.length; i++) {
      const a = candidates[i];
      const adjA = this.adjacencyMap.get(a);
      if (!adjA) continue;

      for (let j = i + 1; j < candidates.length; j++) {
        const b = candidates[j];
        if (!adjA.has(b)) continue; // a and b must have played each other

        // Orientation 1: p1→a→b→p2 (needs a adj p1, b adj p2)
        if (isAdjP1.has(a) && isAdjP2.has(b)) {
          const step1 = Predictions.linkFractions(this.getDirectFraction(p1, a), this.getDirectFraction(a, b));
          fractions.push(Predictions.linkFractions(step1, this.getDirectFraction(b, p2)));
        }

        // Orientation 2: p1→b→a→p2 (needs b adj p1, a adj p2)
        // Skip if both orientations are valid — orientation 1 already covers this pair
        const bAdjP1 = isAdjP1.has(b);
        const aAdjP2 = isAdjP2.has(a);
        if (bAdjP1 && aAdjP2 && isAdjP1.has(a) && isAdjP2.has(b)) continue;

        if (bAdjP1 && aAdjP2) {
          const step1 = Predictions.linkFractions(this.getDirectFraction(p1, b), this.getDirectFraction(b, a));
          fractions.push(Predictions.linkFractions(step1, this.getDirectFraction(a, p2)));
        }
      }
    }

    const result = Predictions.combineFractions(fractions);

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

  getPredictedFraction(p1: string, p2: string): Fraction | undefined {
    const direct = this.getDirectFraction(p1, p2);
    const oneLayer = this.getOneLayerFraction(p1, p2);
    const twoLayer = this.getTwoLayerFraction(p1, p2);

    const combined = Predictions.combinePrioritizedFractions([direct, oneLayer, twoLayer]);
    if (combined.confidence === 0) return undefined;
    return combined;
  }

  // ---------------------------------------------------------------------------
  // Simulated game generation
  // ---------------------------------------------------------------------------

  generateSimulatedGames(gamesPerPairing: number): Game[] {
    const rankedPlayerIds = this.getAllPlayerIds().filter((id) => {
      const isActive = this.parent.eventStore.playersProjector.getPlayer(id)?.active === true;
      return this.getPlayerTotalGames(id) >= this.parent.client.gameLimitForRanked && isActive;
    });

    const predictedGamesTemp: { winner: string; loser: string }[][] = [];

    for (let i = 0; i < rankedPlayerIds.length; i++) {
      for (let j = i + 1; j < rankedPlayerIds.length; j++) {
        const p1 = rankedPlayerIds[i];
        const p2 = rankedPlayerIds[j];

        const direct = this.getDirectFraction(p1, p2);
        const oneLayer = this.getOneLayerFraction(p1, p2);
        const twoLayer = this.getTwoLayerFraction(p1, p2);
        const combinedFraction = Predictions.combinePrioritizedFractions([direct, oneLayer, twoLayer]);

        const predictedWins = gamesPerPairing * combinedFraction.fraction;
        const predictedLoss = gamesPerPairing * (1 - combinedFraction.fraction);

        const pairingGames: { winner: string; loser: string }[] = [];
        for (let k = 0; k < predictedWins; k++) pairingGames.push({ winner: p1, loser: p2 });
        for (let k = 0; k < predictedLoss; k++) pairingGames.push({ winner: p2, loser: p1 });

        predictedGamesTemp.push(pairingGames);
      }
    }

    const games: Game[] = [];
    const now = Date.now();
    for (let round = 0; round < gamesPerPairing; round++) {
      for (const pairingGames of predictedGamesTemp) {
        if (round < pairingGames.length) {
          games.push({
            ...pairingGames[round],
            playedAt: now + games.length,
            id: newId(),
          });
        }
      }
    }

    return games;
  }

  // ---------------------------------------------------------------------------
  // Cache invalidation
  // ---------------------------------------------------------------------------

  clearCache() {
    this.#pairwiseStats = undefined;
    this.#adjacencyMap = undefined;
    this.#oneLayerCache.clear();
    this.#twoLayerCache.clear();
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
    const exactIndex = rawWinFraction * 100;

    const lowerIndex = Math.floor(exactIndex);
    const upperIndex = Math.ceil(exactIndex);

    let expectedWinProbability: number;
    if (lowerIndex === upperIndex || upperIndex > 100) {
      const index = Math.min(Math.max(Math.round(exactIndex), 0), 100);
      expectedWinProbability = probabilityLookup[index];
    } else {
      const lowerValue = probabilityLookup[lowerIndex];
      const upperValue = probabilityLookup[upperIndex];
      expectedWinProbability = lowerValue + (upperValue - lowerValue) * (exactIndex - lowerIndex);
    }

    const addition = wins + loss;
    const product = wins * loss;
    const confidencePoints = addition * additions + product * products;
    const confidence = 1 - Math.pow(2, -Math.pow(confidencePoints / halfLifePoints, curveExponent));

    return { fraction: expectedWinProbability, confidence };
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
    const numerator = fraction1.fraction * fraction2.fraction;
    const denominator = numerator + (1 - fraction1.fraction) * (1 - fraction2.fraction);

    return {
      fraction: denominator === 0 ? 0 : numerator / denominator,
      confidence: fraction1.confidence * fraction2.confidence,
    };
  }
}
