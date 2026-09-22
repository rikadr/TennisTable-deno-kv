import { isSameSet, shuffleArray } from "./array-utils";

describe("shuffleArray", () => {
  it("returns a permutation of the same array", () => {
    const array = [1, 2, 3, 4, 5];
    const result = shuffleArray(array, () => 0.5);
    expect(result).toBe(array);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("uses the given random function one time per swap", () => {
    let calls = 0;
    shuffleArray([1, 2, 3, 4], () => {
      calls++;
      return 0;
    });
    expect(calls).toBe(3);
  });
});

describe("isSameSet", () => {
  it("accepts the same items in any order", () => {
    expect(isSameSet(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
    expect(isSameSet([], [])).toBe(true);
  });

  it("rejects different lengths, missing items and duplicates on either side", () => {
    expect(isSameSet(["a", "b"], ["a"])).toBe(false);
    expect(isSameSet(["a", "b"], ["a", "c"])).toBe(false);
    expect(isSameSet(["a", "b"], ["a", "a"])).toBe(false);
    expect(isSameSet(["a", "a"], ["a", "b"])).toBe(false);
  });
});
