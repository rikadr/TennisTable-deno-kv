import { PairFraction, solveExpectedScores } from "../expected-scores";

const expectedResult = (score: number, opponentScore: number) => 1 / (1 + Math.pow(10, (opponentScore - score) / 400));
const gapFor = (fraction: number) => 400 * Math.log10(fraction / (1 - fraction));
const total = (scores: Map<string, number>) => Array.from(scores.values()).reduce((sum, score) => sum + score, 0);

describe("solveExpectedScores", () => {
  it("gives the score gap where the expected result is the predicted fraction", () => {
    const scores = solveExpectedScores(
      new Map([
        ["a", 1000],
        ["b", 1000],
      ]),
      [{ a: "a", b: "b", fraction: 0.75 }],
    );

    // 400 * log10(3) = 190.8
    expect(scores.get("a")! - scores.get("b")!).toBeCloseTo(gapFor(0.75), 6);
    expect(scores.get("a")!).toBeCloseTo(1000 + gapFor(0.75) / 2, 6);
  });

  it("keeps the total of the start scores and does not depend on how they are split", () => {
    const pairs: PairFraction[] = [{ a: "a", b: "b", fraction: 0.6 }];
    const even = solveExpectedScores(
      new Map([
        ["a", 1050],
        ["b", 1050],
      ]),
      pairs,
    );
    const uneven = solveExpectedScores(
      new Map([
        ["a", 700],
        ["b", 1400],
      ]),
      pairs,
    );

    expect(total(even)).toBeCloseTo(2100, 6);
    expect(uneven.get("a")!).toBeCloseTo(even.get("a")!, 6);
    expect(uneven.get("b")!).toBeCloseTo(even.get("b")!, 6);
  });

  it("finds the exact scores when the predicted fractions agree with each other", () => {
    // Two 0.75 links give 0.75 * 0.75 / (0.75 * 0.75 + 0.25 * 0.25) = 0.9 for a against c
    const scores = solveExpectedScores(
      new Map([
        ["a", 1000],
        ["b", 1000],
        ["c", 1000],
      ]),
      [
        { a: "a", b: "b", fraction: 0.75 },
        { a: "b", b: "c", fraction: 0.75 },
        { a: "a", b: "c", fraction: 0.9 },
      ],
    );

    expect(scores.get("a")! - scores.get("b")!).toBeCloseTo(gapFor(0.75), 6);
    expect(scores.get("b")! - scores.get("c")!).toBeCloseTo(gapFor(0.75), 6);
    expect(scores.get("b")!).toBeCloseTo(1000, 6);
  });

  it("makes the expected results of each player equal to the predicted results", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const fractions = [0.8, 0.35, 0.9, 0.55, 0.2, 0.7, 0.65, 0.95, 0.4, 0.6];
    const pairs: PairFraction[] = [];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) pairs.push({ a: ids[i], b: ids[j], fraction: fractions[pairs.length] });

    const scores = solveExpectedScores(new Map(ids.map((id) => [id, 1000])), pairs);

    for (const id of ids) {
      let missingResult = 0;
      for (const { a, b, fraction } of pairs) {
        if (a === id) missingResult += fraction - expectedResult(scores.get(a)!, scores.get(b)!);
        if (b === id) missingResult += 1 - fraction - expectedResult(scores.get(b)!, scores.get(a)!);
      }
      expect(missingResult).toBeCloseTo(0, 6);
    }
  });

  it("limits a fraction of 1, so the scores stay finite", () => {
    const scores = solveExpectedScores(
      new Map([
        ["a", 1000],
        ["b", 1000],
      ]),
      [{ a: "a", b: "b", fraction: 1 }],
    );

    expect(scores.get("a")! - scores.get("b")!).toBeCloseTo(gapFor(0.999), 3);
  });

  it("keeps the total of each group of connected players, and leaves out a player in no pair", () => {
    const scores = solveExpectedScores(
      new Map([
        ["a", 1200],
        ["b", 1000],
        ["c", 900],
        ["d", 800],
        ["e", 1000],
      ]),
      [
        { a: "a", b: "b", fraction: 0.5 },
        { a: "c", b: "d", fraction: 0.5 },
      ],
    );

    expect(scores.get("a")!).toBeCloseTo(1100, 6);
    expect(scores.get("b")!).toBeCloseTo(1100, 6);
    expect(scores.get("c")!).toBeCloseTo(850, 6);
    expect(scores.get("d")!).toBeCloseTo(850, 6);
    expect(scores.has("e")).toBe(false);
  });
});
