import {
  describeScoreDraftIssue,
  EMPTY_SCORE_DRAFT,
  ScoreDraft,
  scoreDraftIssues,
  scoreDraftOfGameScore,
  scoreDraftToEventData,
  setWinners,
  withBadSide,
  withLoserPoints,
  withoutAllSetPoints,
  withoutSetPoints,
  withPointsStep,
  withResult,
  withSetWinner,
} from "./score-draft";

const draftOf = (winnerSets: number, loserSets: number): ScoreDraft =>
  withResult(EMPTY_SCORE_DRAFT, winnerSets, loserSets);

describe("withResult", () => {
  it("adds 1 empty set per set won", () => {
    expect(draftOf(2, 1).sets).toEqual([{ badSide: null }, { badSide: null }, { badSide: null }]);
  });

  it("keeps the data of the sets that stay and removes sets from the end", () => {
    const draft = withLoserPoints(withLoserPoints(draftOf(3, 0), 0, 5), 2, 7);
    const shorter = withResult(draft, 2, 0);
    expect(shorter.sets).toHaveLength(2);
    expect(shorter.sets[0]).toEqual(draft.sets[0]);
  });
});

describe("setWinners", () => {
  it("gives every set to the game winner when the game loser won no sets", () => {
    expect(setWinners(draftOf(3, 0))).toEqual([1, 1, 1]);
  });

  it("knows no winner while both players can still have won any set", () => {
    expect(setWinners(draftOf(2, 1))).toEqual([null, null, null]);
  });

  it("gives the remaining sets to the game winner when the game loser has all their sets", () => {
    const draft = withSetWinner(draftOf(2, 1), 1, 2);
    expect(setWinners(draft)).toEqual([1, 2, 1]);
  });

  it("gives the remaining sets to the game loser when the game winner has all their sets", () => {
    const draft = withSetWinner(withSetWinner(draftOf(3, 2), 0, 1), 2, 1);
    expect(setWinners(withSetWinner(draft, 4, 1))).toEqual([1, 2, 1, 2, 1]);
  });

  it("uses the points before the pick", () => {
    const draft = withLoserPoints(withSetWinner(draftOf(2, 1), 0, 2), 0, 6);
    expect(draft.sets[0]).toMatchObject({ player1: 6, player2: 11 });
    expect(setWinners(draft)).toEqual([2, 1, 1]);
  });

  it("adds no implied winners when the picks give a player too many sets", () => {
    const draft = withSetWinner(draftOf(2, 0), 0, 2);
    expect(setWinners(draft)).toEqual([2, null]);
  });
});

describe("withLoserPoints", () => {
  it("gives the set winner 11 when the set loser got 9 or less", () => {
    const draft = withLoserPoints(draftOf(2, 0), 0, 7);
    expect(draft.sets[0]).toEqual({ player1: 11, player2: 7, autoFilled: "player1", pickedWinner: 1, badSide: null });
  });

  it("gives the set winner 2 more points after 10-10", () => {
    const draft = withLoserPoints(withSetWinner(draftOf(2, 1), 1, 2), 1, 12);
    expect(draft.sets[1]).toMatchObject({ player1: 12, player2: 14 });
  });

  it("does nothing while the set has no winner", () => {
    const draft = draftOf(2, 1);
    expect(withLoserPoints(draft, 0, 5)).toBe(draft);
  });
});

describe("withSetWinner", () => {
  it("swaps the points when the other player won the set", () => {
    const draft = withSetWinner(withLoserPoints(draftOf(2, 0), 0, 8), 0, 2);
    expect(draft.sets[0]).toMatchObject({ player1: 8, player2: 11, autoFilled: "player2", pickedWinner: 2 });
  });

  it("keeps the points when the same player is picked again", () => {
    const draft = withLoserPoints(draftOf(2, 0), 0, 8);
    expect(withSetWinner(draft, 0, 1).sets[0]).toMatchObject({ player1: 11, player2: 8 });
  });
});

describe("withPointsStep", () => {
  it("moves the calculated points of the set winner with the points of the set loser", () => {
    const draft = withLoserPoints(draftOf(2, 0), 0, 10);
    expect(withPointsStep(draft, 0, 2, 1).sets[0]).toMatchObject({ player1: 13, player2: 11 });
  });

  it("changes only the stepped player when the other points are not calculated", () => {
    const draft = withLoserPoints(draftOf(2, 0), 0, 8);
    expect(withPointsStep(draft, 0, 1, -1).sets[0]).toMatchObject({ player1: 10, player2: 8, autoFilled: undefined });
  });

  it("stops at 0", () => {
    const draft = withLoserPoints(draftOf(2, 0), 0, 0);
    expect(withPointsStep(draft, 0, 2, -1).sets[0]).toMatchObject({ player1: 11, player2: 0 });
  });

  it("does nothing for a set without points", () => {
    const draft = draftOf(2, 0);
    expect(withPointsStep(draft, 0, 1, 1)).toBe(draft);
  });
});

describe("withoutSetPoints", () => {
  it("removes the points and the pick, and keeps the bad side", () => {
    const draft = withLoserPoints(withBadSide(draftOf(2, 0), 0, 1), 0, 4);
    expect(withoutSetPoints(draft, 0).sets[0]).toEqual({ badSide: 1 });
    expect(withoutAllSetPoints(draft).sets).toEqual([{ badSide: 1 }, { badSide: 2 }]);
  });
});

describe("withBadSide", () => {
  it("fills all sets from the first pick, alternating", () => {
    expect(withBadSide(draftOf(3, 1), 1, 2).sets.map((set) => set.badSide)).toEqual([1, 2, 1, 2]);
  });

  it("changes only its own set after the first pick", () => {
    const draft = withBadSide(withBadSide(draftOf(2, 1), 0, 1), 2, "neutral");
    expect(draft.sets.map((set) => set.badSide)).toEqual([1, 2, "neutral"]);
  });
});

describe("scoreDraftIssues", () => {
  it("has no issues for an empty draft or a result without details", () => {
    expect(scoreDraftIssues(EMPTY_SCORE_DRAFT)).toEqual([]);
    expect(scoreDraftIssues(draftOf(2, 1))).toEqual([]);
  });

  it("needs more sets for the game winner", () => {
    expect(scoreDraftIssues(draftOf(1, 1))).toEqual([{ kind: "result" }]);
    expect(scoreDraftIssues(draftOf(0, 2))).toEqual([{ kind: "result" }]);
  });

  it("finds a player with more sets than the result", () => {
    const draft = withSetWinner(draftOf(2, 0), 1, 2);
    expect(scoreDraftIssues(draft)).toEqual([{ kind: "set-winners", slot: 2, sets: 1, resultSets: 0 }]);
  });

  it("finds a tied set", () => {
    const draft = withPointsStep(withLoserPoints(draftOf(1, 0), 0, 10), 0, 1, -2);
    expect(draft.sets[0]).toMatchObject({ player1: 10, player2: 10 });
    expect(scoreDraftIssues(draft)).toEqual([{ kind: "tied-set", setIndex: 0 }]);
  });

  it("needs the points of every set when 1 set has points", () => {
    const draft = withLoserPoints(draftOf(3, 0), 1, 3);
    expect(scoreDraftIssues(draft)).toEqual([{ kind: "missing-points", setIndexes: [0, 2] }]);
  });
});

describe("describeScoreDraftIssue", () => {
  it("names the sets and the players", () => {
    expect(describeScoreDraftIssue({ kind: "missing-points", setIndexes: [0, 2, 3] }, "Ada", "Bo")).toBe(
      "Add the points of sets 1, 3 and 4, or clear the points of all sets.",
    );
    expect(describeScoreDraftIssue({ kind: "set-winners", slot: 2, sets: 2, resultSets: 1 }, "Ada", "Bo")).toBe(
      "Bo won 2 sets below, but the result gives Bo 1 set.",
    );
  });
});

describe("scoreDraftToEventData", () => {
  it("gives null without a result", () => {
    expect(scoreDraftToEventData(EMPTY_SCORE_DRAFT)).toBeNull();
  });

  it("stores only the sets won when no set has points or a side", () => {
    expect(scoreDraftToEventData(draftOf(2, 1))).toEqual({
      setsWon: { gameWinner: 2, gameLoser: 1 },
      setPoints: undefined,
      gameWinnerSides: undefined,
    });
  });

  it("stores the points and the sides from the game winner's perspective", () => {
    let draft = withSetWinner(draftOf(2, 1), 0, 2);
    draft = withLoserPoints(draft, 0, 9);
    draft = withLoserPoints(draft, 1, 4);
    draft = withLoserPoints(draft, 2, 10);
    draft = withBadSide(draft, 0, 1);
    expect(scoreDraftToEventData(draft)).toEqual({
      setsWon: { gameWinner: 2, gameLoser: 1 },
      setPoints: [
        { gameWinner: 9, gameLoser: 11 },
        { gameWinner: 11, gameLoser: 4 },
        { gameWinner: 12, gameLoser: 10 },
      ],
      gameWinnerSides: ["B", "G", "B"],
    });
  });

  it("stores the sides without the points", () => {
    const draft = withBadSide(withBadSide(draftOf(2, 0), 1, "neutral"), 0, null);
    expect(scoreDraftToEventData(draft)?.gameWinnerSides).toEqual([null, "N"]);
  });
});

describe("scoreDraftOfGameScore", () => {
  it("reads a saved score back into a draft", () => {
    const draft = scoreDraftOfGameScore({
      setsWon: { gameWinner: 2, gameLoser: 1 },
      setPoints: [
        { gameWinner: 11, gameLoser: 3 },
        { gameWinner: 8, gameLoser: 11 },
        { gameWinner: 11, gameLoser: 9 },
      ],
      gameWinnerSides: ["G", "B", null],
    });
    expect(draft).toEqual({
      winnerSets: 2,
      loserSets: 1,
      sets: [
        { player1: 11, player2: 3, badSide: 2 },
        { player1: 8, player2: 11, badSide: 1 },
        { player1: 11, player2: 9, badSide: null },
      ],
    });
    expect(scoreDraftToEventData(draft)).toEqual({
      setsWon: { gameWinner: 2, gameLoser: 1 },
      setPoints: [
        { gameWinner: 11, gameLoser: 3 },
        { gameWinner: 8, gameLoser: 11 },
        { gameWinner: 11, gameLoser: 9 },
      ],
      gameWinnerSides: ["G", "B", null],
    });
  });

  it("gives an empty draft for a game without a score", () => {
    expect(scoreDraftOfGameScore(undefined)).toEqual(EMPTY_SCORE_DRAFT);
  });
});
