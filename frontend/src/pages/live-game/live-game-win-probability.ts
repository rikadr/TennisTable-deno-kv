import { LiveGameSetPoint } from "./live-game-types";

/**
 * Live win-probability model for a best-of-3 table tennis match
 * (first to 2 sets; each set first to 11, win by 2 / deuce).
 *
 * Two things evolve as the match is played:
 *
 *  1. ACCURACY — the points actually scored in this game are fresh evidence
 *     about the true per-point skill gap. We start from the pairing prediction
 *     as a Bayesian prior and update it with the live points, so the win % gets
 *     more accurate as more points are played.
 *
 *  2. RESOLUTION — conditioning on the current score, the match-win
 *     probability is pushed toward 0 or 1 as the match nears its end, and the
 *     confidence converges to 100 % as the outcome becomes determined.
 *
 * At 0–0 with no points played the model reproduces the static pairing
 * prediction exactly (both win % and confidence).
 */

export type LiveWinPrediction = {
  /** Probability player 1 wins the match, in [0, 1]. */
  player1WinChance: number;
  /** Confidence in the prediction, in [0, 1]. */
  confidence: number;
};

export type LiveWinPredictionInput = {
  /** Static pairing prediction: player 1's chance to win the match, [0, 1]. */
  basePlayer1WinChance: number;
  /** Static pairing prediction confidence, [0, 1]. */
  baseConfidence: number;
  setsWon: { player1: number; player2: number };
  currentSet: LiveGameSetPoint;
  completedSets: LiveGameSetPoint[];
};

const SETS_TO_WIN_MATCH = 2;
const POINTS_TO_WIN_SET = 11;

// Beta-prior strength mapped from the base confidence. A confident pairing
// prediction is a strong prior (live points move it little); a weak prediction
// is a loose prior (live points dominate quickly).
const PRIOR_STRENGTH_MIN = 6;
const PRIOR_STRENGTH_MAX = 120;

/**
 * Probability player 1 wins a single set given the current set score (a, b),
 * assuming a constant per-point win probability `p`. Handles the win-by-2
 * deuce rule analytically once both players reach 10.
 */
function makeSetSolver(p: number): (a: number, b: number) => number {
  const q = 1 - p;
  // Win probability from an even score in the deuce zone (10–10, 11–11, …):
  // win two in a row, or split and return to even.
  const deuceEven = p * p + q * q === 0 ? 0.5 : (p * p) / (p * p + q * q);
  const memo = new Map<number, number>();

  const solve = (a: number, b: number): number => {
    if (a >= POINTS_TO_WIN_SET && a - b >= 2) return 1;
    if (b >= POINTS_TO_WIN_SET && b - a >= 2) return 0;

    if (a >= POINTS_TO_WIN_SET - 1 && b >= POINTS_TO_WIN_SET - 1) {
      const diff = a - b;
      if (diff >= 2) return 1;
      if (diff <= -2) return 0;
      if (diff === 0) return deuceEven;
      if (diff === 1) return p + q * deuceEven;
      return p * deuceEven; // diff === -1
    }

    const key = a * 100 + b;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const result = p * solve(a + 1, b) + q * solve(a, b + 1);
    memo.set(key, result);
    return result;
  };

  return solve;
}

/**
 * Probability player 1 wins the match given sets won so far, the current set
 * score, and a constant per-point win probability `p`.
 */
function matchWinProbability(
  p: number,
  setsWon1: number,
  setsWon2: number,
  currentA: number,
  currentB: number,
): number {
  if (setsWon1 >= SETS_TO_WIN_MATCH) return 1;
  if (setsWon2 >= SETS_TO_WIN_MATCH) return 0;

  const setSolver = makeSetSolver(p);
  const freshSetWin = setSolver(0, 0);

  const fromSetStart = (s1: number, s2: number): number => {
    if (s1 >= SETS_TO_WIN_MATCH) return 1;
    if (s2 >= SETS_TO_WIN_MATCH) return 0;
    return freshSetWin * fromSetStart(s1 + 1, s2) + (1 - freshSetWin) * fromSetStart(s1, s2 + 1);
  };

  const currentSetWin = setSolver(currentA, currentB);
  return currentSetWin * fromSetStart(setsWon1 + 1, setsWon2) + (1 - currentSetWin) * fromSetStart(setsWon1, setsWon2 + 1);
}

/** Match-win probability for player 1 from a fresh 0–0 start. */
function matchWinFromStart(p: number): number {
  return matchWinProbability(p, 0, 0, 0, 0);
}

/**
 * Invert the match model: find the per-point win probability `p` that yields a
 * given match-win probability from a 0–0 start. Monotonic in `p`, so a binary
 * search converges quickly.
 */
function perPointProbabilityForMatchChance(matchChance: number): number {
  const target = clamp(matchChance, 1e-4, 1 - 1e-4);
  let low = 0;
  let high = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (matchWinFromStart(mid) < target) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeLiveWinPrediction(input: LiveWinPredictionInput): LiveWinPrediction {
  const { basePlayer1WinChance, baseConfidence, setsWon, currentSet, completedSets } = input;

  const baseChance = clamp(basePlayer1WinChance, 1e-4, 1 - 1e-4);

  // Prior per-point probability implied by the static pairing prediction.
  const priorPerPoint = perPointProbabilityForMatchChance(baseChance);

  // Effect 1: blend the live points in as Bayesian evidence about per-point skill.
  const livePointsP1 =
    currentSet.player1 + completedSets.reduce((sum, set) => sum + set.player1, 0);
  const livePointsP2 =
    currentSet.player2 + completedSets.reduce((sum, set) => sum + set.player2, 0);

  const priorStrength = PRIOR_STRENGTH_MIN + baseConfidence * (PRIOR_STRENGTH_MAX - PRIOR_STRENGTH_MIN);
  const alpha = priorPerPoint * priorStrength + livePointsP1;
  const beta = (1 - priorPerPoint) * priorStrength + livePointsP2;
  const updatedPerPoint = alpha / (alpha + beta);

  // Effect 2: condition on the current score. Converges toward 0/1 as the
  // match resolves.
  const player1WinChance = matchWinProbability(
    updatedPerPoint,
    setsWon.player1,
    setsWon.player2,
    currentSet.player1,
    currentSet.player2,
  );

  // Confidence rises from the base toward 100 % as the outcome becomes
  // determined. Measured by how much the match-outcome variance has collapsed
  // relative to the pre-game prediction. At 0–0 with no points this is exactly
  // the base confidence.
  const baseVariance = baseChance * (1 - baseChance);
  const currentVariance = player1WinChance * (1 - player1WinChance);
  const resolution = baseVariance === 0 ? 1 : clamp(1 - currentVariance / baseVariance, 0, 1);
  const confidence = baseConfidence + (1 - baseConfidence) * resolution;

  return { player1WinChance, confidence };
}
