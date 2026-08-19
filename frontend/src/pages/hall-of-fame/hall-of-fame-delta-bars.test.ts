import { MAX_DELTA_BARS, ScorePoint, deltaBars } from "./hall-of-fame-delta-bars";

const ONE_DAY = 24 * 60 * 60 * 1000;
const start = 1_700_000_000_000;

/** `count` points one day apart, each worth 1 point more than the previous. */
function points(count: number): ScorePoint[] {
  return Array.from({ length: count }, (_, i) => ({
    time: start + i * ONE_DAY,
    cumulative: i,
    delta: i === 0 ? 0 : 1,
  }));
}

describe("Hall of Fame delta bars", () => {
  it("gives no bar for fewer than 2 points", () => {
    expect(deltaBars([])).toEqual([]);
    expect(deltaBars(points(1))).toEqual([]);
  });

  it("never gives more bars than the maximum", () => {
    for (const count of [2, 5, 25, 26, 51, 99, 100]) {
      expect(deltaBars(points(count)).length).toBeLessThanOrEqual(MAX_DELTA_BARS);
    }
  });

  it("gives 1 bar per period while the periods fit", () => {
    expect(deltaBars(points(2)).length).toBe(1);
    expect(deltaBars(points(11)).length).toBe(10);
    expect(deltaBars(points(26)).length).toBe(25);
  });

  it("groups the periods of a full simulation into 25 bars", () => {
    expect(deltaBars(points(100)).length).toBe(MAX_DELTA_BARS);
  });

  it("keeps the sum of the bars equal to the score of the last point", () => {
    for (const count of [2, 11, 26, 63, 100]) {
      const all = points(count);
      const total = deltaBars(all).reduce((sum, bar) => sum + bar.delta, 0);
      expect(total).toBe(all[all.length - 1].cumulative);
    }
  });

  it("ends the last bar at the last point", () => {
    const all = points(100);
    const bars = deltaBars(all);
    expect(bars[bars.length - 1].time).toBe(all[all.length - 1].time);
    expect(bars[bars.length - 1].cumulative).toBe(all[all.length - 1].cumulative);
  });

  it("starts the first bar at the day the player joined", () => {
    expect(deltaBars(points(100))[0].from).toBe(start);
  });

  it("joins each period to the end of the previous period", () => {
    const bars = deltaBars(points(100));
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].from).toBe(bars[i - 1].time);
    }
  });

  it("keeps a drop in the score negative", () => {
    const bars = deltaBars([
      { time: start, cumulative: 0, delta: 0 },
      { time: start + ONE_DAY, cumulative: 100, delta: 100 },
      { time: start + 2 * ONE_DAY, cumulative: 85, delta: -15 },
    ]);
    expect(bars.map((bar) => bar.delta)).toEqual([100, -15]);
  });
});
