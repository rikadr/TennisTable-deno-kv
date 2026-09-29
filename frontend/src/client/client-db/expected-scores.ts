import { Elo } from "./elo";

/** The predicted fraction of games that player `a` wins against player `b`. */
export type PairFraction = { a: string; b: string; fraction: number };

/**
 * A fraction of 0 or 1 says that a player can never win against the other. A
 * player with such a result against all opponents has no finite score.
 */
const FRACTION_LIMIT = 0.001;
/** Limits a step when the start scores are far from the solution. */
const MAX_STEP = 100;
const TOLERANCE = 1e-6;
const MAX_ITERATIONS = 1_000;

const expectedResult = (score: number, opponentScore: number) =>
  1 / (1 + Math.pow(10, (opponentScore - score) / Elo.DIVISOR));

/**
 * The scores where the Elo expected result of each player is equal to the
 * predicted result, summed over all the opponents of that player. This is the
 * point that an Elo simulation of the predicted games moves toward as K goes
 * to 0.
 *
 * The scores of each group of connected players add up to the total of their
 * start scores. A player in no pair has no expected score.
 */
export function solveExpectedScores(startScores: Map<string, number>, pairs: PairFraction[]): Map<string, number> {
  const opponents = new Map<string, { id: string; fraction: number }[]>();
  const addOpponent = (id: string, opponentId: string, fraction: number) => {
    if (!opponents.has(id)) opponents.set(id, []);
    opponents.get(id)!.push({ id: opponentId, fraction });
  };
  for (const { a, b, fraction } of pairs) {
    if (!startScores.has(a) || !startScores.has(b)) continue;
    const clamped = Math.min(Math.max(fraction, FRACTION_LIMIT), 1 - FRACTION_LIMIT);
    addOpponent(a, b, clamped);
    addOpponent(b, a, 1 - clamped);
  }

  const scores = new Map<string, number>();
  opponents.forEach((_, id) => scores.set(id, startScores.get(id)!));
  const groups = connectedGroups(opponents);
  const groupTotals = groups.map((group) => group.reduce((sum, id) => sum + scores.get(id)!, 0));

  // Newton steps for one player at a time, with the newest scores of the others.
  const slope = Math.LN10 / Elo.DIVISOR;
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let largestStep = 0;
    opponents.forEach((playerOpponents, id) => {
      const score = scores.get(id)!;
      let missingResult = 0;
      let derivative = 0;
      for (const opponent of playerOpponents) {
        const expected = expectedResult(score, scores.get(opponent.id)!);
        missingResult += opponent.fraction - expected;
        derivative += expected * (1 - expected) * slope;
      }
      const step = Math.min(Math.max(missingResult / derivative, -MAX_STEP), MAX_STEP);
      scores.set(id, score + step);
      largestStep = Math.max(largestStep, Math.abs(step));
    });

    groups.forEach((group, index) => {
      const shift = (groupTotals[index] - group.reduce((sum, id) => sum + scores.get(id)!, 0)) / group.length;
      group.forEach((id) => scores.set(id, scores.get(id)! + shift));
    });

    if (largestStep < TOLERANCE) break;
  }
  return scores;
}

function connectedGroups(opponents: Map<string, { id: string }[]>): string[][] {
  const seen = new Set<string>();
  const groups: string[][] = [];
  opponents.forEach((_, start) => {
    if (seen.has(start)) return;
    const group: string[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const id = queue.pop()!;
      group.push(id);
      for (const opponent of opponents.get(id)!) {
        if (seen.has(opponent.id)) continue;
        seen.add(opponent.id);
        queue.push(opponent.id);
      }
    }
    groups.push(group);
  });
  return groups;
}
