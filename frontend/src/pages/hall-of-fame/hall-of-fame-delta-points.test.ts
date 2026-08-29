import { HallOfFameFactorKey } from "../../client/client-db/hall-of-fame";
import { HallOfFameHistoryPoint } from "../../client/client-db/hall-of-fame-history";
import { deltaPoints } from "./hall-of-fame-delta-points";
import { FACTORS } from "./hall-of-fame-factors";

const ONE_DAY = 24 * 60 * 60 * 1000;
const start = 1_700_000_000_000;

function factors(overrides: Partial<Record<HallOfFameFactorKey, number>> = {}) {
  const all = {} as Record<HallOfFameFactorKey, number>;
  for (const factor of FACTORS) {
    all[factor.key] = overrides[factor.key] ?? 0;
  }
  return all;
}

/** `count` points one day apart. Each point gains 1 peakElo and 2 experience. */
function history(count: number): HallOfFameHistoryPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    time: start + i * ONE_DAY,
    total: i * 3,
    factors: factors({ peakElo: i, experience: i * 2 }),
  }));
}

describe("Hall of Fame delta points", () => {
  it("gives no point for an empty history", () => {
    expect(deltaPoints([])).toEqual([]);
  });

  it("gives 1 delta point per history point", () => {
    for (const count of [1, 2, 26, 100]) {
      expect(deltaPoints(history(count)).length).toBe(count);
    }
  });

  it("gives the first point no period and no gain", () => {
    const [first] = deltaPoints(history(5));
    expect(first.from).toBeUndefined();
    expect(first.total).toBe(0);
    for (const factor of FACTORS) {
      expect(first[factor.key]).toBe(0);
    }
  });

  it("joins each period to the previous point", () => {
    const all = deltaPoints(history(100));
    for (let i = 1; i < all.length; i++) {
      expect(all[i].from).toBe(all[i - 1].time);
    }
  });

  it("gives the gain of each section since the previous point", () => {
    const point = deltaPoints(history(5))[3];
    expect(point.peakElo).toBe(1);
    expect(point.experience).toBe(2);
    expect(point.podiumTime).toBe(0);
    expect(point.total).toBe(3);
  });

  it("keeps the sum of the gains equal to the score of the last point", () => {
    for (const count of [2, 11, 26, 63, 100]) {
      const all = deltaPoints(history(count));
      const total = all.reduce((sum, point) => sum + point.total, 0);
      expect(total).toBe(all[all.length - 1].cumulative);
    }
  });

  it("keeps the total score after the period on the point", () => {
    const all = deltaPoints(history(5));
    expect(all[4].cumulative).toBe(12);
  });

  it("keeps a drop in the score negative", () => {
    const all = deltaPoints([
      { time: start, total: 100, factors: factors({ peakElo: 100 }) },
      { time: start + ONE_DAY, total: 85, factors: factors({ peakElo: 85 }) },
    ]);
    expect(all[1].total).toBe(-15);
    expect(all[1].peakElo).toBe(-15);
  });
});
