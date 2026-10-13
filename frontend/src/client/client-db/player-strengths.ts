import { PairStats } from "./pair-stats";
import type { Fraction } from "./predictions";
import { DEFAULT_LEVEL_WEIGHTS, POINT_SLOPE, SET_SLOPE } from "./whr";

/**
 * The standard deviation of the prior on a strength, on the natural log-strength scale. Each
 * strength starts at 0, an average player. A wide prior lets the first games move a new player
 * far, so 1 bad game puts the player low at once. The uncertainty of the gap then keeps the
 * prediction for such a player away from 0% and 100%.
 *
 * A backtest on the real games gave a log loss of 0.476 at 2.5, 0.474 at 6 and 0.474 at 10. For
 * the games of a player with 1 or 2 games before, it gave 0.499 at 2.5 and 0.452 at 6.
 */
export const STRENGTH_PRIOR_SD = 6;

/**
 * The confidence is 50% when the evidence for the strength gap is equal to this number of games
 * between 2 even players. Each 10 more games halve the remaining uncertainty.
 */
export const CONFIDENCE_HALF_LIFE_GAMES = 10;

/** Fisher information of 1 game between 2 even players: p * (1 - p) at p = 0.5 */
const EVEN_GAME_INFORMATION = 0.25;

/** Largest move of a strength in 1 Newton step, to keep the first steps from a cold start stable */
const MAX_NEWTON_STEP = 1;

/**
 * The fit stops after a step that moves no strength more than this. Near the solution each Newton
 * step makes the error much smaller, so a shared fit and a new fit give the same fraction to 5 digits.
 */
const TOLERANCE = 1e-4;

const MAX_ITERATIONS = 50;

const LEVELS = [
  { slope: 1, weight: DEFAULT_LEVEL_WEIGHTS.game },
  { slope: SET_SLOPE, weight: DEFAULT_LEVEL_WEIGHTS.set },
  { slope: POINT_SLOPE, weight: DEFAULT_LEVEL_WEIGHTS.point },
];

const PRIOR_PRECISION = 1 / (STRENGTH_PRIOR_SD * STRENGTH_PRIOR_SD);

/** Elo points for 1 unit of natural log-strength. A gap of 400 points is a 10 to 1 win ratio */
export const RATING_POINTS_PER_STRENGTH = 400 / Math.LN10;

/** Strengths and gaps are on the natural log-strength scale. See {@link RATING_POINTS_PER_STRENGTH} */
export type PredictionDetails = Fraction & {
  p1: { strength: number; sd: number };
  p2: { strength: number; sd: number };
  gap: number;
  gapSd: number;
  /** sigmoid(gap). The fraction is nearer to 50%, because it includes the uncertainty of the gap */
  fractionWithoutUncertainty: number;
  /** The share of each pair of players in the evidence, largest first, and the share of the prior */
  evidence: { pairs: { p1: string; p2: string; share: number }[]; prior: number };
  /** The fitted strength of each player in the fit */
  strengths: { playerId: string; strength: number }[];
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * One strength for each player, fitted to all the games at once. The chance that A wins against
 * B is sigmoid(strengthA - strengthB), the Bradley-Terry model.
 *
 * Because all players are in the same fit, each game has an effect on each prediction, through
 * chains of opponents of any length. This gives a prediction for 2 players who never played each
 * other, and it adds the games against other opponents to a pair with few games.
 *
 * The fit reads the age-weighted totals of {@link PairStats}. Each level of a result has its own
 * slope and weight: the game result counts most, then the sets, then the points. A game with no
 * set or point score adds only its game result. A normal prior on each strength keeps a player
 * with few games near the average, and gives each gap an uncertainty.
 *
 * Shared strengths start each fit from the strengths of the fit before. A calculation for many
 * reference times then needs only 1 or 2 Newton steps for each time.
 */
export class PlayerStrengths {
  readonly pairStats: PairStats;

  constructor(pairStats: PairStats) {
    this.pairStats = pairStats;
  }

  /** The strengths of the last fit. Kept after the fit, so the next fit starts from them */
  #strengths = new Map<string, number>();
  #fitKey: string | undefined;

  #index = new Map<string, number>();
  #theta = new Float64Array(0);
  /** The connected group of each player. 2 players in different groups have no chain of opponents */
  #group: Int32Array = new Int32Array(0);
  /**
   * The lower triangular Cholesky factor of the Hessian of the last Newton step, n by n. That step
   * moved no strength more than the tolerance, so the factor is also correct at the fitted strengths.
   */
  #cholesky = new Float64Array(0);
  /** H^-1, calculated at the second variance of a fit. A single pair needs only 1 forward substitution */
  #inverse: Float64Array | undefined;
  #varianceReads = 0;

  /**
   * Fits the strengths to the stats at the reference time. A second call with the same stats and
   * reference time does nothing.
   */
  fit(referenceTime: number) {
    const key = `${referenceTime}|${this.pairStats.gameCount}`;
    if (key === this.#fitKey) return;
    this.#fitKey = key;

    const ids = [...this.pairStats.opponents.keys()];
    const n = ids.length;
    this.#index = new Map(ids.map((id, i) => [id, i]));

    // The age-weighted totals of each pair: for each level the wins of the first player and the total
    const pairA: number[] = [];
    const pairB: number[] = [];
    const wins: number[] = [];
    const totals: number[] = [];
    this.pairStats.forEachPair(referenceTime, (p1, p2, won, lost, factor) => {
      pairA.push(this.#index.get(p1)!);
      pairB.push(this.#index.get(p2)!);
      wins.push(won.games * factor, won.sets * factor, won.points * factor);
      totals.push(
        (won.games + lost.games) * factor,
        (won.sets + lost.sets) * factor,
        (won.points + lost.points) * factor,
      );
    });

    const theta = new Float64Array(n);
    for (let i = 0; i < n; i++) theta[i] = this.#strengths.get(ids[i]) ?? 0;

    const gradient = new Float64Array(n);
    const hessian = new Float64Array(n * n);
    const curvature = new Float64Array(pairA.length);
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // The gradient of the log posterior, and the negative of its Hessian
      hessian.fill(0);
      for (let i = 0; i < n; i++) {
        gradient[i] = -theta[i] * PRIOR_PRECISION;
        hessian[i * n + i] = PRIOR_PRECISION;
      }
      for (let p = 0; p < pairA.length; p++) {
        const a = pairA[p];
        const b = pairB[p];
        const difference = theta[a] - theta[b];
        let g = 0;
        let h = 0;
        for (let level = 0; level < LEVELS.length; level++) {
          const total = totals[p * 3 + level];
          if (total === 0) continue;
          const { slope, weight } = LEVELS[level];
          const expected = sigmoid(slope * difference);
          g += weight * slope * (wins[p * 3 + level] - total * expected);
          h += weight * slope * slope * total * expected * (1 - expected);
        }
        gradient[a] += g;
        gradient[b] -= g;
        curvature[p] = h;
        hessian[a * n + a] += h;
        hessian[b * n + b] += h;
        hessian[a * n + b] -= h;
        hessian[b * n + a] -= h;
      }

      PlayerStrengths.#choleskyInPlace(hessian, n);
      const step = PlayerStrengths.#solve(hessian, n, gradient);
      let largest = 0;
      for (let i = 0; i < n; i++) largest = Math.max(largest, Math.abs(step[i]));
      const scale = largest > MAX_NEWTON_STEP ? MAX_NEWTON_STEP / largest : 1;
      for (let i = 0; i < n; i++) theta[i] += step[i] * scale;
      if (largest < TOLERANCE) break;
    }

    this.#theta = theta;
    this.#cholesky = hessian;
    this.#inverse = undefined;
    this.#varianceReads = 0;
    this.#group = PlayerStrengths.#groups(n, pairA, pairB);
    this.#strengths = new Map(ids.map((id, i) => [id, theta[i]]));
    this.#ids = ids;
    this.#pairs = { a: pairA, b: pairB, curvature };
  }

  #ids: string[] = [];
  /** The pairs of the last fit, and the information of each pair at the last Newton step */
  #pairs: { a: number[]; b: number[]; curvature: Float64Array } = { a: [], b: [], curvature: new Float64Array(0) };

  /**
   * The steps from the strengths to the prediction for p1 against p2, for a page that explains the
   * prediction. Undefined when {@link getPrediction} gives no prediction.
   *
   * The evidence shows how much each pair of players adds to the precision of the gap. With
   * u = H^-1 e, the variance of the gap is u' H u: the sum of curvature * (u_a - u_b)^2 for each
   * pair, and of the prior precision * u_i^2 for each player. Each term divided by the variance
   * is the share of that pair, or of the prior.
   */
  getPredictionDetails(p1: string, p2: string): PredictionDetails | undefined {
    const prediction = this.getPrediction(p1, p2);
    const a = this.#index.get(p1);
    const b = this.#index.get(p2);
    if (!prediction || a === undefined || b === undefined) return undefined;

    const n = this.#theta.length;
    this.#inverse ??= PlayerStrengths.#invert(this.#cholesky, n);
    const inverse = this.#inverse;
    const variance = inverse[a * n + a] + inverse[b * n + b] - 2 * inverse[a * n + b];
    const u = new Float64Array(n);
    for (let i = 0; i < n; i++) u[i] = inverse[i * n + a] - inverse[i * n + b];

    const pairs: PredictionDetails["evidence"]["pairs"] = [];
    for (let p = 0; p < this.#pairs.a.length; p++) {
      const pa = this.#pairs.a[p];
      const pb = this.#pairs.b[p];
      const share = (this.#pairs.curvature[p] * (u[pa] - u[pb]) ** 2) / variance;
      if (share > 0) pairs.push({ p1: this.#ids[pa], p2: this.#ids[pb], share });
    }
    pairs.sort((x, y) => y.share - x.share);
    let prior = 0;
    for (let i = 0; i < n; i++) prior += u[i] * u[i] * PRIOR_PRECISION;

    const gap = this.#theta[a] - this.#theta[b];
    return {
      ...prediction,
      p1: { strength: this.#theta[a], sd: Math.sqrt(inverse[a * n + a]) },
      p2: { strength: this.#theta[b], sd: Math.sqrt(inverse[b * n + b]) },
      gap,
      gapSd: Math.sqrt(variance),
      fractionWithoutUncertainty: sigmoid(gap),
      evidence: { pairs, prior: prior / variance },
      strengths: this.#ids.map((id, i) => ({ playerId: id, strength: this.#theta[i] })),
    };
  }

  /**
   * The chance that p1 wins against p2, from the last fit. Undefined when a player has no games, or
   * when no chain of opponents joins the 2 players. Then only the prior separates their strengths.
   *
   * The fraction includes the uncertainty of the gap, so an uncertain gap gives a fraction nearer
   * to 50%. The confidence is from the evidence for the gap, counted as games between 2 even players.
   */
  getPrediction(p1: string, p2: string): Fraction | undefined {
    const a = this.#index.get(p1);
    const b = this.#index.get(p2);
    if (a === undefined || b === undefined || a === b || this.#group[a] !== this.#group[b]) return undefined;

    const variance = this.#gapVariance(a, b);
    const gap = this.#theta[a] - this.#theta[b];
    const fraction = sigmoid(gap / Math.sqrt(1 + (Math.PI * variance) / 8));

    const priorVariance = 2 * STRENGTH_PRIOR_SD * STRENGTH_PRIOR_SD;
    const evidenceGames = Math.max(1 / variance - 1 / priorVariance, 0) / EVEN_GAME_INFORMATION;
    const confidence = 1 - Math.pow(2, -evidenceGames / CONFIDENCE_HALF_LIFE_GAMES);

    return { fraction, confidence };
  }

  /** The posterior variance of strength a - strength b: e' H^-1 e, with e = 1 at a and -1 at b */
  #gapVariance(a: number, b: number): number {
    const n = this.#theta.length;
    if (++this.#varianceReads === 2) this.#inverse = PlayerStrengths.#invert(this.#cholesky, n);
    const inverse = this.#inverse;
    if (inverse) return inverse[a * n + a] + inverse[b * n + b] - 2 * inverse[a * n + b];

    // Forward substitution of L y = e. The entries of y before the first non-zero entry of e are 0
    const factor = this.#cholesky;
    const start = Math.min(a, b);
    const y = new Float64Array(n);
    let variance = 0;
    for (let i = start; i < n; i++) {
      let sum = i === a ? 1 : i === b ? -1 : 0;
      for (let k = start; k < i; k++) sum -= factor[i * n + k] * y[k];
      y[i] = sum / factor[i * n + i];
      variance += y[i] * y[i];
    }
    return variance;
  }

  /** H^-1 = L^-T L^-1 from the Cholesky factor L */
  static #invert(factor: Float64Array, n: number): Float64Array {
    // The lower triangle of L^-1, column by column
    const lowerInverse = new Float64Array(n * n);
    for (let j = 0; j < n; j++) {
      lowerInverse[j * n + j] = 1 / factor[j * n + j];
      for (let i = j + 1; i < n; i++) {
        let sum = 0;
        for (let k = j; k < i; k++) sum -= factor[i * n + k] * lowerInverse[k * n + j];
        lowerInverse[i * n + j] = sum / factor[i * n + i];
      }
    }
    const inverse = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;
        for (let k = i; k < n; k++) sum += lowerInverse[k * n + i] * lowerInverse[k * n + j];
        inverse[i * n + j] = sum;
        inverse[j * n + i] = sum;
      }
    }
    return inverse;
  }

  /** A group number for each player. The players of a pair are in the same group */
  static #groups(n: number, pairA: number[], pairB: number[]): Int32Array {
    const parent = new Int32Array(n);
    for (let i = 0; i < n; i++) parent[i] = i;
    const root = (i: number): number => {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]];
      return i;
    };
    for (let p = 0; p < pairA.length; p++) parent[root(pairA[p])] = root(pairB[p]);
    for (let i = 0; i < n; i++) parent[i] = root(i);
    return parent;
  }

  /** Replaces the lower triangle of the symmetric positive definite matrix with its Cholesky factor */
  static #choleskyInPlace(matrix: Float64Array, n: number) {
    for (let j = 0; j < n; j++) {
      let diagonal = matrix[j * n + j];
      for (let k = 0; k < j; k++) diagonal -= matrix[j * n + k] * matrix[j * n + k];
      const pivot = Math.sqrt(diagonal);
      matrix[j * n + j] = pivot;
      for (let i = j + 1; i < n; i++) {
        let sum = matrix[i * n + j];
        for (let k = 0; k < j; k++) sum -= matrix[i * n + k] * matrix[j * n + k];
        matrix[i * n + j] = sum / pivot;
      }
    }
  }

  /** Solves L L' x = rhs with the Cholesky factor L */
  static #solve(factor: Float64Array, n: number, rhs: Float64Array): Float64Array {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = rhs[i];
      for (let k = 0; k < i; k++) sum -= factor[i * n + k] * y[k];
      y[i] = sum / factor[i * n + i];
    }
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = y[i];
      for (let k = i + 1; k < n; k++) sum -= factor[k * n + i] * x[k];
      x[i] = sum / factor[i * n + i];
    }
    return x;
  }
}
