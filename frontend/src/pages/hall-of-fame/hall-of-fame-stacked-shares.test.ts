import { HallOfFameFactorKey } from "../../client/client-db/hall-of-fame";
import { HallOfFameHistoryPoint } from "../../client/client-db/hall-of-fame-history";
import { FACTORS } from "./hall-of-fame-factors";
import { stackedShares } from "./hall-of-fame-stacked-shares";

const KEYS = FACTORS.map((factor) => factor.key);

function point(time: number, factors: Partial<Record<HallOfFameFactorKey, number>>): HallOfFameHistoryPoint {
  const full = {} as Record<HallOfFameFactorKey, number>;
  for (const key of KEYS) {
    full[key] = factors[key] ?? 0;
  }
  return { time, total: KEYS.reduce((sum, key) => sum + full[key], 0), factors: full };
}

describe("Hall of Fame stacked shares", () => {
  it("gives no points for no points", () => {
    expect(stackedShares([])).toEqual([]);
  });

  it("makes the shares of a point add up to 100", () => {
    const [share] = stackedShares([point(1, { peakElo: 30, experience: 10, longevity: 60 })]);
    const sum = KEYS.reduce((total, key) => total + share[key], 0);
    expect(sum).toBeCloseTo(100);
  });

  it("gives each section its share of the score", () => {
    const [share] = stackedShares([point(1, { peakElo: 75, experience: 25 })]);
    expect(share.peakElo).toBeCloseTo(75);
    expect(share.experience).toBeCloseTo(25);
    expect(share.longevity).toBe(0);
  });

  it("gives 0 to every section when the player has no score", () => {
    const [share] = stackedShares([point(1, {})]);
    for (const key of KEYS) {
      expect(share[key]).toBe(0);
    }
  });

  it("keeps the time and the score in points", () => {
    const [share] = stackedShares([point(42, { peakElo: 8, dataVolume: 2 })]);
    expect(share.time).toBe(42);
    expect(share.total).toBe(10);
    expect(share.absolute.peakElo).toBe(8);
  });

  it("scales one point at a time, so a growing score keeps its shares", () => {
    const shares = stackedShares([
      point(1, { peakElo: 50, experience: 50 }),
      point(2, { peakElo: 500, experience: 500 }),
    ]);
    expect(shares[0].peakElo).toBeCloseTo(50);
    expect(shares[1].peakElo).toBeCloseTo(50);
  });
});
