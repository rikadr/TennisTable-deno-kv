import {
  ConfidenceConfig,
  Fraction,
  GAME_CONFIDENCE_CONFIG,
  POINT_CONFIDENCE_CONFIG,
  SET_CONFIDENCE_CONFIG,
} from "../future-elo";
import { TennisTable } from "../tennis-table";

// Narrow view of FutureElo's private confidence calculation for testing
type FutureEloInternal = {
  getWinFractionWithConfidence(input: {
    wins: number;
    loss: number;
    probabilityLookup: number[];
    confidenceConfig: ConfidenceConfig;
  }): Fraction;
};

describe("FutureElo confidence curve", () => {
  const probabilityLookup = Array.from({ length: 101 }, (_, i) => i / 100);

  const futureElo = new TennisTable({ events: [] }).futureElo as unknown as FutureEloInternal;

  const confidenceOf = (wins: number, loss: number, confidenceConfig: ConfidenceConfig): number =>
    futureElo.getWinFractionWithConfidence({ wins, loss, probabilityLookup, confidenceConfig }).confidence;

  // 10 points per game, no product term: confidence points are linear in game count
  const linearConfig: ConfidenceConfig = { additions: 10, products: 0, halfLifePoints: 50 };

  it("reaches 50% confidence at halfLifePoints", () => {
    expect(confidenceOf(5, 0, linearConfig)).toBeCloseTo(0.5, 10);
  });

  it("gives diminishing returns: doubling the data yields less than double the confidence", () => {
    const confidence5 = confidenceOf(3, 2, linearConfig);
    const confidence10 = confidenceOf(6, 4, linearConfig);

    expect(confidence10).toBeGreaterThan(confidence5);
    expect(confidence10).toBeLessThan(2 * confidence5);
  });

  it("lets each successive batch of games fill a fixed fraction of the remaining uncertainty", () => {
    // With a linear points formula, remaining uncertainty after 2n games
    // is the square of the remaining uncertainty after n games
    const remainingAfter5 = 1 - confidenceOf(3, 2, linearConfig);
    const remainingAfter10 = 1 - confidenceOf(6, 4, linearConfig);

    expect(remainingAfter10).toBeCloseTo(remainingAfter5 * remainingAfter5, 10);
  });

  it("approaches but never reaches 100% confidence", () => {
    const confidence = confidenceOf(25, 25, linearConfig);

    expect(confidence).toBeGreaterThan(0.99);
    expect(confidence).toBeLessThan(1);
  });

  it("requires more data for uneven win/loss ratios to gain the same confidence", () => {
    const balanced = confidenceOf(5, 5, GAME_CONFIDENCE_CONFIG);
    const lopsided = confidenceOf(10, 0, GAME_CONFIDENCE_CONFIG);

    expect(balanced).toBeGreaterThan(lopsided);
  });

  it.each([
    ["games", GAME_CONFIDENCE_CONFIG, 12],
    ["sets", SET_CONFIDENCE_CONFIG, 25],
    ["points", POINT_CONFIDENCE_CONFIG, 420],
  ])("reaches ~90%% confidence at the calibration anchor for %s", (_, config, perPlayer) => {
    const confidence = confidenceOf(perPlayer, perPlayer, config);

    expect(confidence).toBeGreaterThan(0.89);
    expect(confidence).toBeLessThan(0.91);
  });

  it("gives zero confidence with no data", () => {
    const result = futureElo.getWinFractionWithConfidence({
      wins: 1,
      loss: 1,
      probabilityLookup,
      confidenceConfig: { additions: 0, products: 0, halfLifePoints: 50 },
    });

    expect(result.confidence).toBe(0);
  });
});
