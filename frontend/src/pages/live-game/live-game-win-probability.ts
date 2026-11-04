import { DEFAULT_BEST_OF, LiveGameSetPoint } from "./live-game-types";
import { Fraction, POINT_CONFIDENCE_CONFIG, Predictions } from "../../client/client-db/predictions";
import { pointToGame } from "../../client/client-db/future-elo-probability-lookups";

/**
 * Live win-probability model for a best-of-N table tennis match, best of 3 by
 * default (first to 2 sets; each set first to 11, win by 2 / deuce). A match
 * that keeps going past its decided length extends to the next best-of-odd-N —
 * see `setsToWinMatch`.
 *
 * Approach (see chat design):
 *
 *  1. Derive a single per-point win probability for player 1 from
 *     pre-game data + the points played so far in this game.
 *
 *     The static prediction maps point% up to a game% and combines it by
 *     confidence. Here we run that in reverse: we take the pre-game game% and
 *     the live point% and map each back down to a per-point% (`pointToGame` is
 *     a best-of-3-to-11 table, so inverting it is exact), then combine by
 *     confidence into one per-point%.
 *
 *     The sets won are not separate evidence: a set is made of the points that
 *     are already counted. Counting both made a player who won 1 set look much
 *     stronger per point, and the prediction jumped toward 100 %.
 *
 *  2. Monte-Carlo simulate the remainder of the match from the current score
 *     with that per-point% and use the win ratio as the prediction. The
 *     per-point% does not depend on the match length, so a longer match only
 *     changes the simulation: it gives the favourite more room to win.
 *
 * At 0–0 with no points played in a best of 3 this reproduces the static pairing
 * prediction (inverting then simulating the same best-of-3-to-11 model round-trips), and
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
  /** The most sets the match can have: 3, 5, 7… Defaults to 3 (first to 2 sets). */
  bestOf?: number;
  /** Number of Monte-Carlo simulations. Defaults to 1000. */
  simulations?: number;
  /** Injectable RNG for deterministic tests. Defaults to Math.random. */
  random?: () => number;
  /**
   * Skip the second full-match simulation pass that only refines `confidence`
   * (it then stays at the per-point estimate's data confidence). Halves the
   * cost for callers that ignore the confidence, like the game details replay.
   */
  skipConfidenceSimulation?: boolean;
};

const POINTS_TO_WIN_SET = 11;
const DEFAULT_SIMULATIONS = 1000;

/**
 * A current set that is already decided (11+ points, 2 clear) counts as a
 * completed set, so the prediction is the same just before and just after the
 * set win is confirmed and the score returns to 0–0. Without this, the sets won
 * and the match length (`setsToWinMatch`) change at the confirmation, and the
 * prediction jumps.
 */
function normalizeScore(
  input: LiveWinPredictionInput,
): Pick<LiveWinPredictionInput, "setsWon" | "currentSet" | "completedSets"> {
  const { setsWon, currentSet, completedSets } = input;
  const p1Decided = currentSet.player1 >= POINTS_TO_WIN_SET && currentSet.player1 - currentSet.player2 >= 2;
  const p2Decided = currentSet.player2 >= POINTS_TO_WIN_SET && currentSet.player2 - currentSet.player1 >= 2;
  if (!p1Decided && !p2Decided) return { setsWon, currentSet, completedSets };
  return {
    setsWon: {
      player1: setsWon.player1 + (p1Decided ? 1 : 0),
      player2: setsWon.player2 + (p2Decided ? 1 : 0),
    },
    currentSet: { player1: 0, player2: 0 },
    completedSets: [...completedSets, currentSet],
  };
}

/**
 * How many sets win this match. `bestOf` sets the start value (best of 3 is
 * first to 2), but the players can keep going: a set that starts although a
 * player already has enough sets to have won extends the match to the next
 * best-of-odd-N. In a best of 3, a 3rd set at 2–0 or a 4th at 2–1 makes it best
 * of 5 (first to 3), a set after 3 won sets makes it best of 7, and so on.
 *
 * The completed sets replay in order so an extension stays counted after its
 * set ends: 2–1 reached through 2–0 keeps the match a best of 5, while 2–1
 * reached through 1–1 ends a best of 3. When the per-set history does not
 * match the sets won, only a set currently in progress (with at least one
 * point) can extend the match.
 */
function setsToWinMatch(
  setsWon: { player1: number; player2: number },
  completedSets: LiveGameSetPoint[],
  currentSet: LiveGameSetPoint,
  bestOf: number,
): number {
  let setsToWin = Math.floor(bestOf / 2) + 1;
  const currentSetStarted = currentSet.player1 + currentSet.player2 > 0;

  if (completedSets.length === setsWon.player1 + setsWon.player2) {
    let s1 = 0;
    let s2 = 0;
    for (const set of completedSets) {
      if (Math.max(s1, s2) >= setsToWin) setsToWin = Math.max(s1, s2) + 1;
      if (set.player1 > set.player2) s1++;
      else s2++;
    }
    if (currentSetStarted && Math.max(s1, s2) >= setsToWin) setsToWin = Math.max(s1, s2) + 1;
  } else if (currentSetStarted && Math.max(setsWon.player1, setsWon.player2) >= setsToWin) {
    setsToWin = Math.max(setsWon.player1, setsWon.player2) + 1;
  }

  return setsToWin;
}

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
  const { preGameWinChance, preGameConfidence, currentSet, completedSets } = input;

  const livePointsP1 = currentSet.player1 + completedSets.reduce((sum, set) => sum + set.player1, 0);
  const livePointsP2 = currentSet.player2 + completedSets.reduce((sum, set) => sum + set.player2, 0);

  const estimators: Fraction[] = [];

  // Pre-game data (already a combined game%, direct + indirect) → per-point%.
  if (preGameConfidence > 0) {
    estimators.push({ fraction: gameChanceToPerPoint(preGameWinChance), confidence: preGameConfidence });
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

type SimulationSummary = {
  /** Fraction of simulations player 1 won. */
  winRate: number;
  /** Average number of points still to be played before the match ends. */
  avgRemainingPoints: number;
};

/**
 * Simulate the rest of the match many times from a given score. Returns the win
 * rate and the average number of points left to play (used as a measure of how
 * close the match is to finishing).
 */
function runSimulations(
  perPoint: number,
  setsToWin: number,
  setsWon1: number,
  setsWon2: number,
  currentA: number,
  currentB: number,
  simulations: number,
  random: () => number,
): SimulationSummary {
  let wins = 0;
  let totalRemainingPoints = 0;

  for (let i = 0; i < simulations; i++) {
    let s1 = setsWon1;
    let s2 = setsWon2;
    let a = currentA;
    let b = currentB;
    let points = 0;

    while (s1 < setsToWin && s2 < setsToWin) {
      // Play one set to completion, counting the points played.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (a >= POINTS_TO_WIN_SET && a - b >= 2) {
          s1++;
          break;
        }
        if (b >= POINTS_TO_WIN_SET && b - a >= 2) {
          s2++;
          break;
        }
        if (random() < perPoint) a++;
        else b++;
        points++;
      }
      a = 0;
      b = 0;
    }

    if (s1 >= setsToWin) wins++;
    totalRemainingPoints += points;
  }

  return { winRate: wins / simulations, avgRemainingPoints: totalRemainingPoints / simulations };
}

export function computeLiveWinPrediction(input: LiveWinPredictionInput): LiveWinPrediction {
  const simulations = input.simulations ?? DEFAULT_SIMULATIONS;
  const random = input.random ?? Math.random;

  const { setsWon, currentSet, completedSets } = normalizeScore(input);

  const perPoint = derivePerPointWinChance({ ...input, setsWon, currentSet, completedSets });
  const setsToWin = setsToWinMatch(setsWon, completedSets, currentSet, input.bestOf ?? DEFAULT_BEST_OF);

  const current = runSimulations(
    perPoint.fraction,
    setsToWin,
    setsWon.player1,
    setsWon.player2,
    currentSet.player1,
    currentSet.player2,
    simulations,
    random,
  );
  const player1WinChance = current.winRate;

  if (input.skipConfidenceSimulation) {
    return { player1WinChance, confidence: perPoint.confidence, perPointWinChance: perPoint.fraction };
  }

  // Confidence rises from the per-point estimate's data confidence toward 100 %
  // as the match nears its end — measured by how few points remain to be played
  // relative to a full match from 0–0. This is independent of how lopsided the
  // win % is: a tied deciding deuce is high-confidence because we are confident
  // in the prediction (a 50/50), even though the result itself is a coin flip.
  //
  // The mapping is concave (1 − r²) so the final stretch saturates to ~100 %:
  // once only a handful of points remain we are essentially certain of the
  // prediction, whatever it is.
  const fullMatch = runSimulations(perPoint.fraction, setsToWin, 0, 0, 0, 0, simulations, random);
  const remainingRatio = current.avgRemainingPoints / Math.max(fullMatch.avgRemainingPoints, 1);
  const matchProgress = clamp(1 - remainingRatio * remainingRatio, 0, 1);
  const confidence = perPoint.confidence + (1 - perPoint.confidence) * matchProgress;

  return { player1WinChance, confidence, perPointWinChance: perPoint.fraction };
}
