import { GameTracking } from "../../client/client-db/event-store/event-types";
import { durationString, gameTimingStats, gapString, serveStats } from "./game-tracking-stats";

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

  it("measures a set from its first point to its last point", () => {
    // The first delta of a set is the wait before its first point, so it is
    // not part of the set. Set 1 is 50 + 70 + 60, set 2 is 55 + 200 + 45.
    expect(gameTimingStats(tracking()).setDurationsMs).toEqual([18_000, 30_000]);
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
