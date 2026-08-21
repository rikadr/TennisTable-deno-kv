import {
  alignBadSides,
  BadSide,
  badSideLabel,
  badSideName,
  badSideOfGameWinnerSide,
  gameWinnerSideOfBadSide,
  nextSetBadSide,
  winnerSideOfSet,
} from "./table-sides";

describe("nextSetBadSide", () => {
  it("moves the bad side to the other player", () => {
    expect(nextSetBadSide(1)).toBe(2);
    expect(nextSetBadSide(2)).toBe(1);
  });

  it("keeps a neutral or unrecorded set as it is", () => {
    expect(nextSetBadSide("neutral")).toBe("neutral");
    expect(nextSetBadSide(null)).toBe(null);
  });
});

describe("gameWinnerSideOfBadSide", () => {
  it("encodes the side of the game winner as G or B", () => {
    expect(gameWinnerSideOfBadSide(1, 1)).toBe("B");
    expect(gameWinnerSideOfBadSide(2, 1)).toBe("G");
    expect(gameWinnerSideOfBadSide(1, 2)).toBe("G");
    expect(gameWinnerSideOfBadSide(2, 2)).toBe("B");
  });

  it("encodes 2 equally good sides as N", () => {
    expect(gameWinnerSideOfBadSide("neutral", 1)).toBe("N");
    expect(gameWinnerSideOfBadSide("neutral", 2)).toBe("N");
  });

  it("returns undefined for a set with no recorded side", () => {
    expect(gameWinnerSideOfBadSide(null, 1)).toBeUndefined();
    expect(gameWinnerSideOfBadSide(null, 2)).toBeUndefined();
  });
});

describe("badSideOfGameWinnerSide", () => {
  it("is the inverse of gameWinnerSideOfBadSide for every side and slot", () => {
    const sides: BadSide[] = [1, 2, "neutral", null];
    for (const slot of [1, 2] as const) {
      for (const side of sides) {
        expect(badSideOfGameWinnerSide(gameWinnerSideOfBadSide(side, slot), slot)).toBe(side);
      }
    }
  });
});

describe("winnerSideOfSet", () => {
  it("reads the side of one set", () => {
    expect(winnerSideOfSet("GBN", 0)).toBe("G");
    expect(winnerSideOfSet("GBN", 1)).toBe("B");
    expect(winnerSideOfSet("GBN", 2)).toBe("N");
  });

  it("returns undefined for a game or a set without sides", () => {
    expect(winnerSideOfSet(undefined, 0)).toBeUndefined();
    expect(winnerSideOfSet("GB", 2)).toBeUndefined();
    expect(winnerSideOfSet("X", 0)).toBeUndefined();
  });
});

describe("badSideLabel", () => {
  it("names the player who has the bad side", () => {
    expect(badSideLabel(1, "Ada", "Bo")).toBe("Ada on the bad side");
    expect(badSideLabel(2, "Ada", "Bo")).toBe("Bo on the bad side");
  });

  it("labels equal sides, and gives no label for an unrecorded set", () => {
    expect(badSideLabel("neutral", "Ada", "Bo")).toBe("Equal sides");
    expect(badSideLabel(null, "Ada", "Bo")).toBe(null);
  });

  it("gives no label for a set past the end of a side list", () => {
    // A game tracked before the sides existed has fewer sides than sets.
    const badSides: BadSide[] = [];
    expect(badSideLabel(badSides[0], "Ada", "Bo")).toBe(null);
  });
});

describe("alignBadSides", () => {
  it("pads a short side list with a null per set", () => {
    expect(alignBadSides([], 2)).toEqual([null, null]);
    expect(alignBadSides([1], 3)).toEqual([1, null, null]);
  });

  it("keeps a list that already covers every set", () => {
    expect(alignBadSides([1, "neutral"], 2)).toEqual([1, "neutral"]);
  });

  it("cuts a list that is longer than the sets", () => {
    expect(alignBadSides([1, 2], 1)).toEqual([1]);
  });
});

describe("badSideName", () => {
  it("names the player who had the bad side of a stored set", () => {
    expect(badSideName("B", "Ada", "Bo")).toBe("Ada");
    expect(badSideName("G", "Ada", "Bo")).toBe("Bo");
    expect(badSideName("N", "Ada", "Bo")).toBe("Equal");
  });
});

describe("a set of sides through the whole flow", () => {
  it("keeps the side of every set when the players change sides", () => {
    // The operator records set 1 and the tracker alternates from there.
    let badSide: BadSide = 1;
    const sides: BadSide[] = [];
    for (let set = 0; set < 3; set++) {
      sides.push(badSide);
      badSide = nextSetBadSide(badSide);
    }
    expect(sides.map((side) => gameWinnerSideOfBadSide(side, 1))).toEqual(["B", "G", "B"]);
    expect(sides.map((side) => gameWinnerSideOfBadSide(side, 2))).toEqual(["G", "B", "G"]);
  });
});
