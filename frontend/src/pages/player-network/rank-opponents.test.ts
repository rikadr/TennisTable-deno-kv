import { isMutualTopOpponent, rankOpponents } from "./rank-opponents";

const game = (player1: string, player2: string) => ({ player1, player2 });

describe("rankOpponents", () => {
  it("orders opponents by game count, most first", () => {
    const ranked = rankOpponents([game("a", "b"), game("a", "c"), game("c", "a"), game("a", "d"), game("d", "a")]);
    // c and d have 2 games each. d has the more recent game.
    expect(ranked.get("a")).toEqual(["d", "c", "b"]);
  });

  it("ranks the opponent with the more recent game higher on a tie", () => {
    const ranked = rankOpponents([game("a", "b"), game("a", "c")]);
    expect(ranked.get("a")).toEqual(["c", "b"]);
  });
});

describe("isMutualTopOpponent", () => {
  // a plays b 3 times and c 2 times. c plays d 5 times.
  const ranked = rankOpponents([
    game("a", "b"),
    game("a", "b"),
    game("b", "a"),
    game("a", "c"),
    game("c", "a"),
    ...Array.from({ length: 5 }, () => game("c", "d")),
  ]);

  it("links 2 players when each is in the top list of the other", () => {
    expect(isMutualTopOpponent(ranked, "a", "b", 1)).toBe(true);
  });

  it("does not link 2 players when only one has the other in the top list", () => {
    // c is the 2nd opponent of a, but a is the 2nd opponent of c.
    expect(isMutualTopOpponent(ranked, "a", "c", 1)).toBe(false);
    expect(isMutualTopOpponent(ranked, "a", "c", 2)).toBe(true);
  });

  it("does not link players who never played", () => {
    expect(isMutualTopOpponent(ranked, "b", "d", 10)).toBe(false);
  });
});
