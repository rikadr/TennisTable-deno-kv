import { achievementProgressPercentage } from "./achievement-progress";

describe("achievementProgressPercentage", () => {
  it("measures achievements without a baseline from 0", () => {
    expect(achievementProgressPercentage("close-calls", 1, 5)).toBe(20);
    expect(achievementProgressPercentage("close-calls", 5, 5)).toBe(100);
  });

  it("measures marathon-set from 11 instead of 0", () => {
    // Best deuce set won of 13 with a target of 16 (one beyond the league
    // record of 15): 2 of 5 points.
    expect(achievementProgressPercentage("marathon-set", 13, 16)).toBe(40);
    expect(achievementProgressPercentage("marathon-set", 12, 16)).toBe(20);
    expect(achievementProgressPercentage("marathon-set", 14, 16)).toBe(60);
  });

  it("gives marathon-set 100% on reaching the target", () => {
    expect(achievementProgressPercentage("marathon-set", 15, 15)).toBe(100);
  });

  it("gives 0% for marathon-set when the player has won no deuce set", () => {
    expect(achievementProgressPercentage("marathon-set", 0, 15)).toBe(0);
  });

  it("returns 0 when there is no target to chase", () => {
    expect(achievementProgressPercentage("marathon-set", 13, undefined)).toBe(0);
    expect(achievementProgressPercentage("close-calls", 3, undefined)).toBe(0);
  });

  it("caps at 100%", () => {
    expect(achievementProgressPercentage("marathon-set", 20, 15)).toBe(100);
    expect(achievementProgressPercentage("close-calls", 9, 5)).toBe(100);
  });

  it("handles a target at or below the baseline as all-or-nothing", () => {
    expect(achievementProgressPercentage("marathon-set", 12, 11)).toBe(100);
    expect(achievementProgressPercentage("marathon-set", 10, 11)).toBe(0);
  });
});
