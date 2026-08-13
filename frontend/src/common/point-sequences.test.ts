import { appendPointToSequence, removeLastPointFromSequence, toEventPointSequences } from "./point-sequences";

describe("appendPointToSequence", () => {
  it("appends the player's digit to the sequence", () => {
    expect(appendPointToSequence("", 1)).toBe("1");
    expect(appendPointToSequence("112", 2)).toBe("1122");
  });
});

describe("removeLastPointFromSequence", () => {
  it("removes the player's last point and keeps later points", () => {
    expect(removeLastPointFromSequence("1121", 2)).toBe("111");
    expect(removeLastPointFromSequence("1121", 1)).toBe("112");
  });

  it("returns the sequence unchanged when the player has no points", () => {
    expect(removeLastPointFromSequence("111", 2)).toBe("111");
    expect(removeLastPointFromSequence("", 1)).toBe("");
  });
});

describe("toEventPointSequences", () => {
  const completedSets = [
    { player1: 3, player2: 1 },
    { player1: 1, player2: 2 },
  ];
  const setSequences = ["1211", "212"];

  it("encodes sequences as W/L from the game winner's perspective", () => {
    expect(toEventPointSequences({ setSequences, completedSets, player1IsGameWinner: true })).toEqual([
      "WLWW",
      "LWL",
    ]);
    expect(toEventPointSequences({ setSequences, completedSets, player1IsGameWinner: false })).toEqual([
      "LWLL",
      "WLW",
    ]);
  });

  it("returns undefined when there are no completed sets", () => {
    expect(toEventPointSequences({ setSequences: [], completedSets: [], player1IsGameWinner: true })).toBeUndefined();
  });

  it("returns undefined when a set has no sequence", () => {
    expect(
      toEventPointSequences({ setSequences: ["1211"], completedSets, player1IsGameWinner: true }),
    ).toBeUndefined();
  });

  it("returns undefined when a sequence does not match its set's points", () => {
    expect(
      toEventPointSequences({ setSequences: ["1211", "211"], completedSets, player1IsGameWinner: true }),
    ).toBeUndefined();
  });
});
