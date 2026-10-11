import { PairStats } from "./pair-stats";
import type { Fraction } from "./predictions";
import { DEFAULT_LEVEL_WEIGHTS, POINT_SLOPE, SET_SLOPE } from "./whr";

/**
 * The standard deviation of the prior on a strength, on the natural log-strength scale. A player
 * with few games stays near the average player, and the games move the strength away from it.
 * A backtest on the real games gave the lowest log loss from about 2.5 to 3.5.
 */
export const STRENGTH_PRIOR_SD = 2.5;

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
 * The fit stops after a step that moves no strength more than this. Near the solution, the error
 * after a Newton step is about the square of the step, so the strengths are then exact to about 1e-6.
 */
const TOLERANCE = 1e-3;

const MAX_ITERATIONS = 50;

const LEVELS = [
  { slope: 1, weight: DEFAULT_LEVEL_WEIGHTS.game },
  { slope: SET_SLOPE, weight: DEFAULT_LEVEL_WEIGHTS.set },
  { slope: POINT_SLOPE, weight: DEFAULT_LEVEL_WEIGHTS.point },
];

const PRIOR_PRECISION = 1 / (STRENGTH_PRIOR_SD * STRENGTH_PRIOR_SD);

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
  /** The lower triangular Cholesky factor of the Hessian at the fitted strengths, n by n */
  #cholesky = new Float64Array(0);

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
    this.#strengths = new Map(ids.map((id, i) => [id, theta[i]]));
  }

  /** The fitted strength of the player. Undefined for a player with no games */
  getStrength(playerId: string): number | undefined {
    return this.#strengths.get(playerId);
  }

  /**
   * The chance that p1 wins against p2, from the last fit. Undefined when a player has no games.
   *
   * The fraction includes the uncertainty of the gap, so an uncertain gap gives a fraction nearer
   * to 50%. The confidence is from the evidence for the gap, counted as games between 2 even players.
   */
  getPrediction(p1: string, p2: string): Fraction | undefined {
    const a = this.#index.get(p1);
    const b = this.#index.get(p2);
    if (a === undefined || b === undefined || a === b) return undefined;

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
    const factor = this.#cholesky;
    // Forward substitution of L y = e. The entries of y before the first non-zero entry of e are 0
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
