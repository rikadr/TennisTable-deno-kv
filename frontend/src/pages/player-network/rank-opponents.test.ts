import { isMutualTopOpponent, rankOpponents } from "./rank-opponents";

const pair = (player1: string, player2: string, games: number, lastPlayed = 0) => ({
  player1,
  player2,
  games,
  lastPlayed,
});

describe("rankOpponents", () => {
  it("orders opponents by game count, most first", () => {
    const ranked = rankOpponents([pair("a", "b", 1), pair("c", "a", 3), pair("a", "d", 2)]);
    expect(ranked.get("a")).toEqual(["c", "d", "b"]);
  });

  it("ranks the opponent with the more recent game higher on a tie", () => {
    const ranked = rankOpponents([pair("a", "b", 2, 5), pair("a", "c", 2, 9)]);
    expect(ranked.get("a")).toEqual(["c", "b"]);
  });
});

describe("isMutualTopOpponent", () => {
  // a plays b 3 times and c 2 times. c plays d 5 times.
  const ranked = rankOpponents([pair("a", "b", 3), pair("a", "c", 2), pair("c", "d", 5)]);

  it("links 2 players when each is in the top list of the other", () => {
    expect(isMutualTopOpponent(ranked, "a", "b", 1)).toBe(true);
  });

  it("does not link 2 players when only one has the other in the top list", () => {
    // c is the 2nd opponent of a, and a is the 2nd opponent of c.
    expect(isMutualTopOpponent(ranked, "a", "c", 1)).toBe(false);
    expect(isMutualTopOpponent(ranked, "a", "c", 2)).toBe(true);
  });

  it("does not link players who never played", () => {
    expect(isMutualTopOpponent(ranked, "b", "d", 10)).toBe(false);
  });
});
