import { LiveGameSetPoint } from "./live-game-types";
import {
  Fraction,
  POINT_CONFIDENCE_CONFIG,
  Predictions,
  SET_CONFIDENCE_CONFIG,
} from "../../client/client-db/predictions";
import { pointToGame, setToGame } from "../../client/client-db/future-elo-probability-lookups";

/**
 * Live win-probability model for a best-of-3 table tennis match
 * (first to 2 sets; each set first to 11, win by 2 / deuce).
 *
 * Approach (see chat design):
 *
 *  1. Derive a single per-point win probability for player 1 from
 *     pre-game data + the points/sets played so far in this game.
 *
 *     The static prediction maps point% and set% up to a game% and combines
 *     them by confidence. Here we run that in reverse: we take the pre-game
 *     game% and the live set% / point% and map each back down to a per-point%
 *     (`pointToGame` and `setToGame` are best-of-3-to-11 tables, so inverting
 *     them is exact), then combine by confidence into one per-point%.
 *
 *  2. Monte-Carlo simulate the remainder of the match from the current score
 *     with that per-point% and use the win ratio as the prediction.
 *
 * At 0–0 with no points played this reproduces the static pairing prediction
 * (inverting then simulating the same best-of-3-to-11 model round-trips), and
 * as points/sets are played the per-point% sharpens and the simulated win
 * ratio converges toward 0/1 as the match nears its end.
 */

export type LiveWinPrediction = {
  /** Probability player 1 wins the match, in [0, 1]. */
  player1WinChance: number;
  /** Confidence in the prediction, in [0, 1]. */
  confidence: number;
  /** The derived per-point win probability used for the simulation. */
  perPointWinChance: number;
};

export type LiveWinPredictionInput = {
  /** Pre-game pairing prediction: player 1's chance to win the match, [0, 1]. */
  preGameWinChance: number;
  /** Pre-game pairing prediction confidence, [0, 1]. */
  preGameConfidence: number;
  setsWon: { player1: number; player2: number };
  currentSet: LiveGameSetPoint;
  completedSets: LiveGameSetPoint[];
  /** Number of Monte-Carlo simulations. Defaults to 1000. */
  simulations?: number;
  /** Injectable RNG for deterministic tests. Defaults to Math.random. */
  random?: () => number;
};

const SETS_TO_WIN_MATCH = 2;
const POINTS_TO_WIN_SET = 11;
const DEFAULT_SIMULATIONS = 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Interpolated lookup of a [0..100]-indexed probability table at fraction x ∈ [0, 1]. */
function lookupAtFraction(table: number[], x: number): number {
  const exact = clamp(x, 0, 1) * 100;
  const lower = Math.floor(exact);
  const upper = Math.ceil(exact);
  if (lower === upper) return table[lower];
  return table[lower] + (table[upper] - table[lower]) * (exact - lower);
}

/**
 * Invert a "level% → game%" table to recover the per-point win probability that
 * would produce a given game-win probability. `pointToGame` is monotonic, so a
 * binary search converges quickly.
 */
function gameChanceToPerPoint(gameChance: number): number {
  const target = clamp(gameChance, 0, 1);
  let low = 0;
  let high = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (lookupAtFraction(pointToGame, mid) < target) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

/**
 * Combine pre-game and live evidence into a single per-point win probability for
 * player 1. Each source is expressed as a per-point% with a confidence and
 * combined with the same confidence-prioritised blend used by the static
 * predictions.
 */
function derivePerPointWinChance(input: LiveWinPredictionInput): Fraction {
  const { preGameWinChance, preGameConfidence, setsWon, currentSet, completedSets } = input;

  const livePointsP1 = currentSet.player1 + completedSets.reduce((sum, set) => sum + set.player1, 0);
  const livePointsP2 = currentSet.player2 + completedSets.reduce((sum, set) => sum + set.player2, 0);
  const liveSetsP1 = setsWon.player1;
  const liveSetsP2 = setsWon.player2;

  const estimators: Fraction[] = [];

  // Pre-game data (already a combined game%, direct + indirect) → per-point%.
  if (preGameConfidence > 0) {
    estimators.push({ fraction: gameChanceToPerPoint(preGameWinChance), confidence: preGameConfidence });
  }

  // Live sets → per-point% (set% → game% → per-point%).
  if (liveSetsP1 + liveSetsP2 > 0) {
    const setLevel = Predictions.getWinFractionWithConfidence(
      liveSetsP1,
      liveSetsP2,
      setToGame,
      SET_CONFIDENCE_CONFIG,
    );
    estimators.push({ fraction: gameChanceToPerPoint(setLevel.fraction), confidence: setLevel.confidence });
  }

  // Live points → per-point% (point% maps to itself, i.e. the raw point fraction).
  if (livePointsP1 + livePointsP2 > 0) {
    const pointLevel = Predictions.getWinFractionWithConfidence(
      livePointsP1,
      livePointsP2,
      pointToGame,
      POINT_CONFIDENCE_CONFIG,
    );
    estimators.push({ fraction: gameChanceToPerPoint(pointLevel.fraction), confidence: pointLevel.confidence });
  }

  const combined = Predictions.combinePrioritizedFractions(estimators);
  // No evidence at all → an even coin flip.
  if (combined.confidence === 0) return { fraction: 0.5, confidence: 0 };
  return combined;
}

/** Play a single set to completion from (a, b); returns the winning player (1 or 2). */
function simulateSet(perPoint: number, startA: number, startB: number, random: () => number): 1 | 2 {
  let a = startA;
  let b = startB;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (a >= POINTS_TO_WIN_SET && a - b >= 2) return 1;
    if (b >= POINTS_TO_WIN_SET && b - a >= 2) return 2;
    if (random() < perPoint) a++;
    else b++;
  }
}

/** Simulate the rest of the match once from the current score; returns true if player 1 wins. */
function simulateMatchOnce(
  perPoint: number,
  setsWon1: number,
  setsWon2: number,
  currentA: number,
  currentB: number,
  random: () => number,
): boolean {
  let s1 = setsWon1;
  let s2 = setsWon2;
  let a = currentA;
  let b = currentB;
  while (s1 < SETS_TO_WIN_MATCH && s2 < SETS_TO_WIN_MATCH) {
    if (simulateSet(perPoint, a, b, random) === 1) s1++;
    else s2++;
    a = 0;
    b = 0;
  }
  return s1 >= SETS_TO_WIN_MATCH;
}

export function computeLiveWinPrediction(input: LiveWinPredictionInput): LiveWinPrediction {
  const { setsWon, currentSet, preGameWinChance, preGameConfidence } = input;
  const simulations = input.simulations ?? DEFAULT_SIMULATIONS;
  const random = input.random ?? Math.random;

  const perPoint = derivePerPointWinChance(input);

  let wins = 0;
  for (let i = 0; i < simulations; i++) {
    if (simulateMatchOnce(perPoint.fraction, setsWon.player1, setsWon.player2, currentSet.player1, currentSet.player2, random)) {
      wins++;
    }
  }
  const player1WinChance = wins / simulations;

  // Confidence rises from the per-point estimate's data confidence toward 100 %
  // as the match outcome becomes determined (outcome-variance collapse relative
  // to the pre-game prediction). At 0–0 with no points this is the pre-game
  // confidence.
  const baseMatchChance = preGameConfidence > 0 ? preGameWinChance : 0.5;
  const baseVariance = Math.max(baseMatchChance * (1 - baseMatchChance), 1e-6);
  const currentVariance = player1WinChance * (1 - player1WinChance);
  const resolution = clamp(1 - currentVariance / baseVariance, 0, 1);
  const confidence = perPoint.confidence + (1 - perPoint.confidence) * resolution;

  return { player1WinChance, confidence, perPointWinChance: perPoint.fraction };
}
