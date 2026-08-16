import { GameTracking } from "../../client/client-db/event-store/event-types";
import {
  durationString,
  gameTimingStats,
  gapString,
  longestStreaks,
  pointPace,
  serveStats,
  setBreakdown,
} from "./game-tracking-stats";

function tracking(overrides: Partial<GameTracking> = {}): GameTracking {
  return {
    version: 1,
    source: "track-game",
    startedAt: 1_700_000_000_000,
    pointDeltas: [
      [100, 50, 70, 60],
      [600, 55, 200, 45],
    ],
    endedAfter: 90,
    firstServers: "WL",
    corrections: 0,
    ...overrides,
  };
}

describe("gameTimingStats", () => {
  it("sums every delta into the duration of the game", () => {
    // 100 + 50 + 70 + 60 + 600 + 55 + 200 + 45 tenths = 118 seconds.
    expect(gameTimingStats(tracking()).durationMs).toBe(118_000);
  });

  it("leaves the break between sets out of the gaps between points", () => {
    const stats = gameTimingStats(tracking());
    // The 600 tenth break and the 100 tenth start are both excluded.
    expect(stats.longestPointGapMs).toBe(20_000);
    expect(stats.averagePointGapMs).toBe(((50 + 70 + 60 + 55 + 200 + 45) / 6) * 100);
  });

  it("reports zero gaps for a game of single-point sets", () => {
    const stats = gameTimingStats(tracking({ pointDeltas: [[100], [200]] }));
    expect(stats.longestPointGapMs).toBe(0);
    expect(stats.averagePointGapMs).toBe(0);
    expect(stats.durationMs).toBe(30_000);
  });
});

describe("setBreakdown", () => {
  // 4 points in set 1, 4 in set 2, matching the deltas of the tracking above.
  const pointSequences = ["WWLW", "LWLL"];

  it("reads the score and the winner of each set from the winner's side", () => {
    const sets = setBreakdown(pointSequences, tracking());
    expect(sets.map((set) => set.points)).toEqual([
      { winner: 3, loser: 1 },
      { winner: 1, loser: 3 },
    ]);
    expect(sets.map((set) => set.wonByGameWinner)).toEqual([true, false]);
  });

  it("splits the first delta of a set off as the break before it", () => {
    const sets = setBreakdown(pointSequences, tracking());
    // Set 1 starts 100 tenths in and runs 50 + 70 + 60 tenths.
    expect(sets[0]).toMatchObject({ breakBeforeMs: 10_000, durationMs: 18_000, longestPointGapMs: 7_000 });
    // Set 2 starts after a 600 tenth break and runs 55 + 200 + 45 tenths.
    expect(sets[1]).toMatchObject({ breakBeforeMs: 60_000, durationMs: 30_000, longestPointGapMs: 20_000 });
  });

  it("reads the first server of each set", () => {
    expect(setBreakdown(pointSequences, tracking()).map((set) => set.firstServer)).toEqual(["W", "L"]);
  });

  it("returns no rows for a game with no sets", () => {
    expect(setBreakdown([], tracking({ pointDeltas: [], firstServers: "" }))).toEqual([]);
  });
});

describe("longestStreaks", () => {
  it("finds the longest run of points in a row for each player", () => {
    expect(longestStreaks(["WWWLW", "LLWL"])).toEqual({ winner: 3, loser: 2 });
  });

  it("carries a run across a set boundary, because the points are consecutive", () => {
    expect(longestStreaks(["LWW", "WWL"])).toEqual({ winner: 4, loser: 1 });
  });

  it("returns zero for a player who won no point", () => {
    expect(longestStreaks(["WWW"])).toEqual({ winner: 3, loser: 0 });
    expect(longestStreaks([])).toEqual({ winner: 0, loser: 0 });
  });
});

describe("pointPace", () => {
  const pointSequences = ["WWLW", "LWLL"];

  it("gives the first point of each set no time, because that gap is the break", () => {
    const pace = pointPace(pointSequences, tracking());
    expect(pace[0].seconds).toBeNull();
    expect(pace[4].seconds).toBeNull();
  });

  it("converts the other deltas to seconds", () => {
    const pace = pointPace(pointSequences, tracking());
    expect(pace.map((point) => point.seconds)).toEqual([null, 5, 7, 6, null, 5.5, 20, 4.5]);
  });

  it("numbers the points over the whole game and names the set of each", () => {
    const pace = pointPace(pointSequences, tracking());
    expect(pace.map((point) => point.point)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(pace.map((point) => point.set)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it("keeps who won each point", () => {
    expect(pointPace(pointSequences, tracking()).map((point) => point.scoredBy)).toEqual([
      "W",
      "W",
      "L",
      "W",
      "L",
      "W",
      "L",
      "L",
    ]);
  });
});

describe("serveStats", () => {
  it("counts the points each player played on their own serve", () => {
    // One set, the game winner serves first. Serve changes every 2 points, so
    // the winner serves points 1, 2, 5, 6 and the loser serves points 3, 4.
    const stats = serveStats(["WLLWWL"], "W");
    expect(stats.winner.served).toBe(4);
    expect(stats.loser.served).toBe(2);
  });

  it("counts the points won on serve for each player", () => {
    // The winner serves points 1, 2, 5 and 6, and wins points 1 and 5 of them.
    // The loser serves points 3 and 4, and wins point 3 only.
    const stats = serveStats(["WLLWWL"], "W");
    expect(stats.winner.won).toBe(2);
    expect(stats.loser.won).toBe(1);
  });

  it("reads the first server of each set separately", () => {
    // Same 2 points in both sets, but the server of the set swaps.
    const stats = serveStats(["WW", "WW"], "WL");
    expect(stats.winner).toEqual({ served: 2, won: 2 });
    expect(stats.loser).toEqual({ served: 2, won: 0 });
  });

  it("returns empty counts for an empty log", () => {
    expect(serveStats([], "")).toEqual({ winner: { served: 0, won: 0 }, loser: { served: 0, won: 0 } });
  });
});

describe("durationString", () => {
  it("formats seconds, minutes and hours", () => {
    expect(durationString(38_000)).toBe("38s");
    expect(durationString(252_000)).toBe("4m 12s");
    expect(durationString(3_840_000)).toBe("1h 04m");
  });
});

describe("gapString", () => {
  it("keeps the tenth of a second for a short gap", () => {
    expect(gapString(7_400)).toBe("7.4s");
    expect(gapString(0)).toBe("0.0s");
  });

  it("switches to minutes for a gap of a minute or more", () => {
    expect(gapString(90_000)).toBe("1m 30s");
  });
});
