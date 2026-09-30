import { Elo } from "./elo";

/** The predicted fraction of games that player `a` wins against player `b`. */
export type PairFraction = { a: string; b: string; fraction: number };

type Opponent = { index: number; fraction: number };

/**
 * A fraction of 0 or 1 says that a player can never win against the other. A
 * player with such a result against all opponents has no finite score.
 */
const FRACTION_LIMIT = 0.001;
/** Limits a step when the start scores are far from the solution. */
const MAX_STEP = 200;
/** Newton steps converge fast, so a step this small, in points, means that the scores are solved. */
const TOLERANCE = 1e-9;
const MAX_ITERATIONS = 100;
const MAX_HALVINGS = 30;
const SLOPE = Math.LN10 / Elo.DIVISOR;

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
  for (const group of connectedGroups(opponents)) {
    const index = new Map(group.map((id, i) => [id, i]));
    const groupOpponents = group.map((id) =>
      opponents.get(id)!.map((opponent) => ({ index: index.get(opponent.id)!, fraction: opponent.fraction })),
    );
    const solved = solveGroup(
      group.map((id) => startScores.get(id)!),
      groupOpponents,
    );
    group.forEach((id, i) => scores.set(id, solved[i]));
  }
  return scores;
}

/** Predicted results minus expected results, for each player. The values add up to 0. */
function missingResults(scores: number[], opponents: Opponent[][]): number[] {
  return opponents.map((playerOpponents, i) =>
    playerOpponents.reduce(
      (sum, opponent) => sum + opponent.fraction - Elo.expectedResult(scores[i], scores[opponent.index]),
      0,
    ),
  );
}

const sumOfSquares = (values: number[]) => values.reduce((sum, value) => sum + value * value, 0);

/**
 * Newton steps for all the players of one connected group together. The
 * derivative of the missing results is a graph Laplacian L, which has no
 * inverse. The step solves (L + 1/n) step = missing results instead: the
 * missing results add up to 0, so the step also adds up to 0 and the total
 * score stays the same.
 */
function solveGroup(startScores: number[], opponents: Opponent[][]): number[] {
  let scores = [...startScores];
  let missing = missingResults(scores, opponents);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const step = solveLinear(newtonMatrix(scores, opponents), missing);
    const largestStep = Math.max(...step.map(Math.abs));
    if (largestStep < TOLERANCE) break;

    // Take the largest part of the step that makes the missing results smaller.
    const before = sumOfSquares(missing);
    let size = Math.min(1, MAX_STEP / largestStep);
    let halving = 0;
    for (; halving < MAX_HALVINGS; halving++, size /= 2) {
      const candidate = addStep(scores, step, size);
      const candidateMissing = missingResults(candidate, opponents);
      if (sumOfSquares(candidateMissing) < before) {
        scores = candidate;
        missing = candidateMissing;
        break;
      }
    }
    if (halving === MAX_HALVINGS) break;
  }
  return scores;
}

/** L + 1/n, where L is the derivative of the missing results with the sign changed. */
function newtonMatrix(scores: number[], opponents: Opponent[][]): number[][] {
  const n = scores.length;
  const matrix = Array.from({ length: n }, () => new Array<number>(n).fill(1 / n));
  for (let i = 0; i < n; i++) {
    for (const opponent of opponents[i]) {
      const expected = Elo.expectedResult(scores[i], scores[opponent.index]);
      const weight = expected * (1 - expected) * SLOPE;
      matrix[i][i] += weight;
      matrix[i][opponent.index] -= weight;
    }
  }
  return matrix;
}

function addStep(scores: number[], step: number[], size: number): number[] {
  const result = new Array<number>(scores.length);
  for (let i = 0; i < scores.length; i++) result[i] = scores[i] + size * step[i];
  return result;
}

/** Solves matrix * x = values with Gaussian elimination and partial pivoting. */
function solveLinear(matrix: number[][], values: number[]): number[] {
  const n = values.length;
  const rows = matrix.map((row, i) => [...row, values[i]]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    for (let row = column + 1; row < n; row++) {
      const factor = rows[row][column] / rows[column][column];
      for (let k = column; k <= n; k++) rows[row][k] -= factor * rows[column][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = rows[row][n];
    for (let k = row + 1; k < n; k++) sum -= rows[row][k] * x[k];
    x[row] = sum / rows[row][row];
  }
  return x;
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
