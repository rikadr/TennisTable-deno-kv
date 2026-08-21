import { GameTracking } from "../../client/client-db/event-store/event-types";
import {
  durationString,
  gameTimingStats,
  gamePoints,
  gapString,
  longestStreaks,
  pointSituations,
  serveStats,
  setBreakdown,
  setProgressions,
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
  const setPoints = [
    { gameWinner: 3, gameLoser: 1 },
    { gameWinner: 1, gameLoser: 3 },
  ];

  it("reads the score and the winner of each set from the winner's side", () => {
    const sets = setBreakdown(pointSequences, tracking(), setPoints);
    expect(sets.map((set) => set.points)).toEqual([
      { winner: 3, loser: 1 },
      { winner: 1, loser: 3 },
    ]);
    expect(sets.map((set) => set.wonByGameWinner)).toEqual([true, false]);
  });

  it("splits the first delta of a set off as the break before it", () => {
    const sets = setBreakdown(pointSequences, tracking(), setPoints);
    // Set 1 starts 100 tenths in and runs 50 + 70 + 60 tenths.
    expect(sets[0]).toMatchObject({ breakBeforeMs: 10_000, durationMs: 18_000, longestPointGapMs: 7_000 });
    // Set 2 starts after a 600 tenth break and runs 55 + 200 + 45 tenths.
    expect(sets[1]).toMatchObject({ breakBeforeMs: 60_000, durationMs: 30_000, longestPointGapMs: 20_000 });
  });

  it("reads the first server of each set", () => {
    expect(setBreakdown(pointSequences, tracking(), setPoints).map((set) => set.firstServer)).toEqual(["W", "L"]);
  });

  it("reads the table side of each set from its setPoints entry", () => {
    const sided = [
      { ...setPoints[0], gameWinnerSide: "B" as const },
      { ...setPoints[1], gameWinnerSide: "N" as const },
    ];
    const sets = setBreakdown(pointSequences, tracking(), sided);
    expect(sets.map((set) => set.winnerSide)).toEqual(["B", "N"]);
  });

  it("gives no table side for a game that does not record the sides", () => {
    expect(setBreakdown(pointSequences, tracking(), setPoints).map((set) => set.winnerSide)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("returns no rows for a game with no sets", () => {
    expect(setBreakdown([], tracking({ pointDeltas: [], firstServers: "" }), [])).toEqual([]);
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

describe("gamePoints", () => {
  const pointSequences = ["WWLW", "LWLL"];

  it("gives the first point of each set no time, because that gap is the break", () => {
    const points = gamePoints(pointSequences, tracking());
    expect(points[0].seconds).toBeNull();
    expect(points[4].seconds).toBeNull();
  });

  it("converts the other deltas to seconds", () => {
    const points = gamePoints(pointSequences, tracking());
    expect(points.map((point) => point.seconds)).toEqual([null, 5, 7, 6, null, 5.5, 20, 4.5]);
  });

  it("numbers the points over the whole game and names the set of each", () => {
    const points = gamePoints(pointSequences, tracking());
    expect(points.map((point) => point.point)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(points.map((point) => point.set)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it("keeps who won each point", () => {
    expect(gamePoints(pointSequences, tracking()).map((point) => point.scoredBy)).toEqual([
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

  it("reads the server of each point from the first server and the set score", () => {
    // The serve changes every 2 points, and it restarts each set with the first
    // server of that set: the winner in set 1, the loser in set 2.
    expect(gamePoints(pointSequences, tracking()).map((point) => point.servedBy)).toEqual([
      "W",
      "W",
      "L",
      "L",
      "L",
      "L",
      "W",
      "W",
    ]);
  });

  it("returns no points for an empty log", () => {
    expect(gamePoints([], tracking({ pointDeltas: [], firstServers: "" }))).toEqual([]);
  });
});

describe("setProgressions", () => {
  it("starts each set at 0-0 and adds a step per point", () => {
    const [set] = setProgressions(["WWLW"]);
    expect(set.steps).toEqual([
      { played: 0, winner: 0, loser: 0, scoredBy: null },
      { played: 1, winner: 1, loser: 0, scoredBy: "W" },
      { played: 2, winner: 2, loser: 0, scoredBy: "W" },
      { played: 3, winner: 2, loser: 1, scoredBy: "L" },
      { played: 4, winner: 3, loser: 1, scoredBy: "W" },
    ]);
  });

  it("numbers the sets and reads the final score and the winner of each", () => {
    const sets = setProgressions(["WWLW", "LWLL"]);
    expect(sets.map((set) => set.set)).toEqual([1, 2]);
    expect(sets.map((set) => set.final)).toEqual([
      { winner: 3, loser: 1 },
      { winner: 1, loser: 3 },
    ]);
    expect(sets.map((set) => set.wonByGameWinner)).toEqual([true, false]);
  });

  it("returns no sets for an empty log", () => {
    expect(setProgressions([])).toEqual([]);
  });
});

describe("pointSituations", () => {
  const pointSequences = ["WWLW", "LWLL"];

  it("counts every point of the game for the all-points situation", () => {
    const situations = pointSituations(pointSequences, tracking());
    // The winner took 4 of the 8 points, so both players sit on 50%.
    expect(situations.find((situation) => situation.label === "All points")).toMatchObject({
      winner: 50,
      loser: 50,
      winnerOf: 8,
      loserOf: 8,
    });
  });

  it("counts each player's own serve from their own side", () => {
    const situations = pointSituations(pointSequences, tracking());
    // The winner served points 1, 2, 7 and 8 and won points 1 and 2 of them.
    expect(situations.find((situation) => situation.label === "Own serve")).toMatchObject({
      winner: 50,
      loser: 50,
      winnerOf: 4,
      loserOf: 4,
    });
    // On the other side of the same serves: the winner won 2 of the 4 points
    // the loser served, and the loser won 2 of the 4 the winner served.
    expect(situations.find((situation) => situation.label === "Their serve")).toMatchObject({
      winner: 50,
      loser: 50,
    });
  });

  it("splits the timed points into a slower and a faster half at the median", () => {
    const situations = pointSituations(pointSequences, tracking());
    // The 6 timed points are 5, 7, 6, 5.5, 20 and 4.5 seconds, so the median is
    // 5.75s: 6, 7 and 20 are slower and 4.5, 5 and 5.5 are faster.
    const slower = situations.find((situation) => situation.label === "Long points");
    const faster = situations.find((situation) => situation.label === "Short points");
    expect(slower).toMatchObject({ winnerOf: 3, loserOf: 3 });
    expect(faster).toMatchObject({ winnerOf: 3, loserOf: 3 });
    // The slower points went to the winner, the loser and the loser.
    expect(slower?.winner).toBeCloseTo(100 / 3);
    expect(faster?.winner).toBeCloseTo(200 / 3);
  });

  it("leaves out a situation with no points on either side", () => {
    // A single point per set is never timed, so the two pace situations go.
    const situations = pointSituations(["W", "L"], tracking({ pointDeltas: [[100], [200]] }));
    expect(situations.map((situation) => situation.label)).toEqual(["All points", "Own serve", "Their serve"]);
  });

  it("returns no situations for an empty log", () => {
    expect(pointSituations([], tracking({ pointDeltas: [], firstServers: "" }))).toEqual([]);
  });
});

describe("serveStats", () => {
  it("counts the points each player played on their own serve", () => {
    // One set, the game winner serves first. Serve changes every 2 points, so
    // the winner serves points 1, 2, 5, 6 and the loser serves points 3, 4.
    const stats = serveStats(["WLLWWL"], tracking({ pointDeltas: [[10, 10, 10, 10, 10, 10]], firstServers: "W" }));
    expect(stats.winner.served).toBe(4);
    expect(stats.loser.served).toBe(2);
  });

  it("counts the points won on serve for each player", () => {
    // The winner serves points 1, 2, 5 and 6, and wins points 1 and 5 of them.
    // The loser serves points 3 and 4, and wins point 3 only.
    const stats = serveStats(["WLLWWL"], tracking({ pointDeltas: [[10, 10, 10, 10, 10, 10]], firstServers: "W" }));
    expect(stats.winner.won).toBe(2);
    expect(stats.loser.won).toBe(1);
  });

  it("reads the first server of each set separately", () => {
    // Same 2 points in both sets, but the server of the set swaps.
    const stats = serveStats(["WW", "WW"], tracking({ pointDeltas: [[10, 10], [10, 10]], firstServers: "WL" }));
    expect(stats.winner).toEqual({ served: 2, won: 2 });
    expect(stats.loser).toEqual({ served: 2, won: 0 });
  });

  it("returns empty counts for an empty log", () => {
    expect(serveStats([], tracking({ pointDeltas: [], firstServers: "" }))).toEqual({ winner: { served: 0, won: 0 }, loser: { served: 0, won: 0 } });
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
