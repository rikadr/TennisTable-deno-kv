import { seededRandom } from "../../tournaments/seeded-random";

const numbers = (random: () => number, count: number) => Array.from({ length: count }, () => random());

describe("seededRandom", () => {
  it("gives the same numbers for the same seeds", () => {
    expect(numbers(seededRandom(42, 1), 10)).toEqual(numbers(seededRandom(42, 1), 10));
  });

  it("gives different numbers for different seeds", () => {
    expect(numbers(seededRandom(42, 1), 10)).not.toEqual(numbers(seededRandom(42, 2), 10));
    expect(numbers(seededRandom(42, 1), 10)).not.toEqual(numbers(seededRandom(43, 1), 10));
  });

  it("gives numbers from 0 to 1 with an even spread", () => {
    const values = numbers(seededRandom(7), 100_000);
    const buckets = new Array<number>(10).fill(0);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      buckets[Math.floor(value * 10)]++;
    }
    // Each bucket expects 10 000, with a standard deviation of about 95
    for (const count of buckets) expect(Math.abs(count - 10_000)).toBeLessThan(500);
  });
});
