import { FillableSetPoints, setWinnerPoints, updateSetPoints } from "./set-points-fill";

describe("setWinnerPoints", () => {
  it("gives 11 when the loser got 9 or less", () => {
    expect(setWinnerPoints(0)).toBe(11);
    expect(setWinnerPoints(6)).toBe(11);
    expect(setWinnerPoints(9)).toBe(11);
  });

  it("gives 2 more than the loser after 10-10", () => {
    expect(setWinnerPoints(10)).toBe(12);
    expect(setWinnerPoints(16)).toBe(18);
  });
});

describe("updateSetPoints", () => {
  it("fills the empty slot with the points of the set winner", () => {
    expect(updateSetPoints({}, "player1", 6)).toEqual({ player1: 6, player2: 11, autoFilled: "player2" });
    expect(updateSetPoints({}, "player2", 16)).toEqual({ player1: 18, player2: 16, autoFilled: "player1" });
  });

  it("updates a calculated slot while the players type", () => {
    const afterFirstDigit = updateSetPoints({}, "player1", 1);
    expect(updateSetPoints(afterFirstDigit, "player1", 15)).toEqual({
      player1: 15,
      player2: 17,
      autoFilled: "player2",
    });
  });

  it("clears a calculated slot when the typed slot is cleared", () => {
    const filled = updateSetPoints({}, "player1", 6);
    expect(updateSetPoints(filled, "player1", undefined)).toEqual({
      player1: undefined,
      player2: undefined,
      autoFilled: undefined,
    });
  });

  it("keeps the calculated value when the players edit that slot", () => {
    const filled = updateSetPoints({}, "player1", 11);
    expect(updateSetPoints(filled, "player2", 5)).toEqual({ player1: 11, player2: 5, autoFilled: undefined });
  });

  it("does not change a slot the players typed", () => {
    expect(updateSetPoints({ player1: 11, player2: 5 }, "player2", 7)).toEqual({
      player1: 11,
      player2: 7,
      autoFilled: undefined,
    });
  });

  it("keeps the other fields of the set", () => {
    const set: FillableSetPoints & { badSide: number } = { badSide: 1 };
    expect(updateSetPoints(set, "player1", 3)).toEqual({
      badSide: 1,
      player1: 3,
      player2: 11,
      autoFilled: "player2",
    });
  });
});
