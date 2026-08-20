import {
  BadSide,
  badSideLabel,
  badSideName,
  encodeWinnerSides,
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

describe("encodeWinnerSides", () => {
  it("encodes the side of the game winner as G or B", () => {
    // Player 1 has the bad side in set 1 and player 2 in set 2.
    expect(encodeWinnerSides([1, 2], 1)).toBe("BG");
    expect(encodeWinnerSides([1, 2], 2)).toBe("GB");
  });

  it("encodes 2 equally good sides as N", () => {
    expect(encodeWinnerSides(["neutral", 1, "neutral"], 1)).toBe("NBN");
  });

  it("returns undefined when a set has no recorded side", () => {
    expect(encodeWinnerSides([1, null], 1)).toBeUndefined();
    expect(encodeWinnerSides([null], 1)).toBeUndefined();
  });

  it("returns undefined for a game with no sets", () => {
    expect(encodeWinnerSides([], 1)).toBeUndefined();
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
    expect(encodeWinnerSides(sides, 1)).toBe("BGB");
    expect(encodeWinnerSides(sides, 2)).toBe("GBG");
  });
});
