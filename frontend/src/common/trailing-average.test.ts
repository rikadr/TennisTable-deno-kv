import { trailingAverage } from "./trailing-average";

describe("trailingAverage", () => {
  it("averages the last `window` values at every point", () => {
    expect(trailingAverage([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7]);
  });

  it("averages the values there are before a full window exists", () => {
    expect(trailingAverage([3, 6, 9], 6)).toEqual([3, 4.5, 6]);
  });

  it("returns nothing for no values", () => {
    expect(trailingAverage([], 6)).toEqual([]);
  });
});
