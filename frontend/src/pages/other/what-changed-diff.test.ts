import { absentScoreZero, buildDiffRows, RankedEntry, scoreDelta } from "./what-changed-diff";

const entry = (id: string, rank: number, score: number): RankedEntry => ({ id, rank, score });

describe("what changed diff rows", () => {
  const start = [entry("a", 1, 1_100), entry("b", 2, 1_000)];

  it("sorts by the rank at the start and at the end", () => {
    const end = [entry("b", 1, 1_050), entry("a", 2, 1_050)];

    expect(buildDiffRows(start, end, "start").map((row) => row.playerId)).toEqual(["a", "b"]);
    expect(buildDiffRows(start, end, "end").map((row) => row.playerId)).toEqual(["b", "a"]);
  });

  it("puts a player who is absent from the sorted leaderboard last", () => {
    const end = [entry("c", 1, 1_200), ...start];
    const rows = buildDiffRows(start, end, "start");
    expect(rows.map((row) => row.playerId)).toEqual(["a", "b", "c"]);
  });

  it("sorts by the score delta, biggest gain first", () => {
    const end = [entry("b", 1, 1_200), entry("a", 2, 1_000)];
    const rows = buildDiffRows(start, end, "delta");
    expect(rows.map((row) => row.playerId)).toEqual(["b", "a"]);
  });

  describe("a player who joins the leaderboard", () => {
    // The Hall of Fame score and the season score of a new player start at 0.
    const end = [entry("c", 1, 1_200), entry("a", 2, 1_100), entry("b", 3, 1_000)];

    it("gains the full score when the score starts at 0", () => {
      const rows = buildDiffRows(start, end, "delta", absentScoreZero);
      expect(rows.map((row) => row.playerId)).toEqual(["c", "a", "b"]);
      expect(scoreDelta(rows[0], absentScoreZero)).toBe(1_200);
    });

    it("gains the change of the score that it had while absent", () => {
      // The overall leaderboard reads the elo of an unranked player instead.
      const eloWhileAbsent = () => 1_150;
      const rows = buildDiffRows(start, end, "delta", eloWhileAbsent);
      expect(rows.map((row) => row.playerId)).toEqual(["c", "a", "b"]);
      expect(scoreDelta(rows[0], eloWhileAbsent)).toBe(50);
    });

    it("sorts last with no delta when no absent score exists", () => {
      const rows = buildDiffRows(start, end, "delta");
      expect(rows.map((row) => row.playerId)).toEqual(["a", "b", "c"]);
      expect(scoreDelta(rows[2])).toBeUndefined();
    });
  });

  it("scores a player who leaves the leaderboard as a loss", () => {
    const end = [entry("a", 1, 1_100)];
    const rows = buildDiffRows(start, end, "delta", absentScoreZero);
    expect(rows.map((row) => row.playerId)).toEqual(["a", "b"]);
    expect(scoreDelta(rows[1], absentScoreZero)).toBe(-1_000);
  });

  it("uses the absent score of the side that the player is absent from", () => {
    const absent = (playerId: string, side: "start" | "end") => (side === "start" ? 10 : 20);

    expect(scoreDelta({ playerId: "a", endScore: 100 }, absent)).toBe(90);
    expect(scoreDelta({ playerId: "a", startScore: 100 }, absent)).toBe(-80);
    expect(scoreDelta({ playerId: "a", startScore: 100, endScore: 120 }, absent)).toBe(20);
  });
});
