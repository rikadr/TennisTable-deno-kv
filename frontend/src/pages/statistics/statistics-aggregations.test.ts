import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { Game } from "../../client/client-db/event-store/projectors/games-projector";
import { Player } from "../../client/client-db/event-store/projectors/players-projector";
import { Elo } from "../../client/client-db/elo";
import {
  GapView,
  activityTrend,
  detailLevels,
  forEachGameWithPreGameStanding,
  gameLevelStats,
  MIN_GAMES_PER_BUCKET,
  pairingCoverage,
  percent,
  PreGameStanding,
  rankedMix,
  rankMovement,
  pointLevelStats,
  ratingGapDistribution,
  setLevelStats,
  timeOfDayShares,
  trackedLevelStats,
  trackedShareTrend,
  upsetRate,
  weakerPlayer,
  weekdayShares,
} from "./statistics-aggregations";

// 2024-01-01 was a Monday, so a weekday index is easy to reason about.
const MONDAY = new Date(2024, 0, 1, 12, 0).getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

function player(id: string): Player {
  return { id, name: id, active: true, createdAt: 0, updatedAt: 0 };
}

let nextGame = 0;
function game(partial: Partial<Game> = {}): Game {
  nextGame++;
  return {
    id: `game-${nextGame}`,
    playedAt: MONDAY + nextGame * 1000,
    winner: "alice",
    loser: "bob",
    ...partial,
  };
}

function games(count: number, partial: Partial<Game> = {}): Game[] {
  return Array.from({ length: count }, () => game(partial));
}

beforeEach(() => {
  nextGame = 0;
});

describe("percent", () => {
  it("is exact, and leaves the precision of the printed value to fmtNum", () => {
    expect(percent(1, 3)).toBeCloseTo(33.333);
    // A tiny share must survive as a fraction. Rounding here would print 0%.
    expect(percent(1, 400)).toBeCloseTo(0.25);
  });

  it("is 0 for an empty group instead of NaN", () => {
    expect(percent(0, 0)).toBe(0);
  });
});

describe("weekdayShares", () => {
  it("gives the share of all games on each day", () => {
    const played = [
      ...games(3, { playedAt: MONDAY }),
      ...games(1, { playedAt: MONDAY + DAY_MS }),
    ].map((entry, index) => ({ ...entry, playedAt: entry.playedAt + index }));

    const shares = weekdayShares(played);

    expect(shares).toHaveLength(7);
    expect(shares.reduce((sum, day) => sum + day.share, 0)).toBeCloseTo(100);
    expect(shares[0]).toMatchObject({ weekday: "Monday", share: 75 });
    expect(shares[1]).toMatchObject({ weekday: "Tuesday", share: 25 });
  });

  it("reports a share and never a count", () => {
    const shares = weekdayShares(games(4));
    expect(Object.keys(shares[0]).sort()).toEqual(["share", "short", "weekday"]);
  });

  it("adds up to 100 even when the counts do not divide evenly", () => {
    const played = games(3).map((entry, index) => ({ ...entry, playedAt: MONDAY + index * DAY_MS }));

    expect(weekdayShares(played).reduce((sum, day) => sum + day.share, 0)).toBeCloseTo(100);
  });
});

describe("timeOfDayShares", () => {
  it("covers the slots from the earliest game to the latest, gaps included", () => {
    const played = [
      game({ playedAt: new Date(2024, 0, 1, 8, 5).getTime() }),
      game({ playedAt: new Date(2024, 0, 1, 9, 0).getTime() }),
    ];

    const slots = timeOfDayShares(played);

    expect(slots[0].slot).toBe("08:00");
    expect(slots[slots.length - 1].slot).toBe("09:00");
    expect(slots).toHaveLength(5);
    expect(slots.filter((slot) => slot.share > 0)).toHaveLength(2);
  });

  it("measures each slot against the busiest one", () => {
    const played = [
      ...games(10, { playedAt: new Date(2024, 0, 1, 8, 5).getTime() }),
      ...games(5, { playedAt: new Date(2024, 0, 1, 8, 20).getTime() }),
    ].map((entry, index) => ({ ...entry, playedAt: entry.playedAt + index }));

    expect(timeOfDayShares(played).map((slot) => slot.share)).toEqual([100, 50]);
  });

  /**
   * A share of the total would round a slot holding a few percent of the games
   * down to 0, and the quiet parts of the day would vanish from the chart.
   */
  it("keeps a slot visible when it holds a tiny part of all the games", () => {
    const busy = games(400, { playedAt: new Date(2024, 0, 1, 12, 0).getTime() });
    const quiet = games(8, { playedAt: new Date(2024, 0, 1, 12, 15).getTime() });
    const played = [...busy, ...quiet].map((entry, index) => ({ ...entry, playedAt: entry.playedAt + index }));

    const slots = timeOfDayShares(played);

    expect(slots[0].share).toBe(100);
    expect(slots[1].share).toBe(2);
  });

  it("returns nothing for no games", () => {
    expect(timeOfDayShares([])).toEqual([]);
  });
});

describe("activityTrend", () => {
  it("indexes every period against the busiest one, which reads 100", () => {
    const played = [
      ...games(4, { playedAt: new Date(2024, 0, 10).getTime() }),
      ...games(2, { playedAt: new Date(2024, 2, 10).getTime() }),
    ].map((entry, index) => ({ ...entry, playedAt: entry.playedAt + index }));

    const trend = activityTrend(played, "month");

    // January, the empty February, and March.
    expect(trend.map((point) => point.share)).toEqual([100, 0, 50]);
    expect(trend.map((point) => point.period)).toEqual(["2024-01", "2024-02", "2024-03"]);
  });

  it("steps a month at a time even when the first game is on the 31st", () => {
    const played = [
      game({ playedAt: new Date(2024, 0, 31).getTime() }),
      game({ playedAt: new Date(2024, 2, 5).getTime() }),
    ];

    expect(activityTrend(played, "month").map((point) => point.period)).toEqual(["2024-01", "2024-02", "2024-03"]);
  });

  it("returns nothing for no games", () => {
    expect(activityTrend([], "month")).toEqual([]);
  });
});

describe("detailLevels", () => {
  const withSets = { setsWon: { gameWinner: 2, gameLoser: 0 } };
  const withPoints = { ...withSets, setPoints: [{ gameWinner: 11, gameLoser: 5 }] };
  const tracked = {
    ...withPoints,
    pointSequences: ["WWWWWWWWWWWLLLLL"],
    tracking: {
      version: 1 as const,
      source: "live-game" as const,
      startedAt: 1,
      pointDeltas: [new Array(16).fill(10)],
      endedAfter: 10,
      firstServers: "W",
      corrections: 0,
    },
  };

  it("stays silent for a period that holds no game", () => {
    expect(detailLevels([])).toBeUndefined();
  });

  it("gives the shares of a single game", () => {
    const levels = detailLevels([game({ score: tracked })])!;

    expect(levels.withSets).toBe(100);
    expect(levels.withPoints).toBe(100);
    expect(levels.tracked).toBe(100);
    expect(levels.trackedOnLiveScreen).toBe(100);
  });

  it("nests strictly: tracked is inside points, which is inside sets", () => {
    const played = [
      ...games(4, { score: tracked }),
      ...games(3, { score: withPoints }),
      ...games(2, { score: withSets }),
      ...games(1),
    ].map((entry, index) => ({ ...entry, playedAt: MONDAY + index }));

    const levels = detailLevels(played)!;

    expect(levels.withSets).toBe(90);
    expect(levels.withPoints).toBe(70);
    expect(levels.tracked).toBe(40);
    expect(levels.tracked).toBeLessThanOrEqual(levels.withPoints);
    expect(levels.withPoints).toBeLessThanOrEqual(levels.withSets);
    expect(levels.trackedOnLiveScreen).toBe(100);
  });
});

describe("gameLevelStats", () => {
  const HOUR_MS = 60 * 60 * 1000;

  it("stays silent for a period that holds no game", () => {
    expect(gameLevelStats([])).toBeUndefined();
  });

  it("reads the rematches, the revenges and the form of the winner", () => {
    const played = [
      game({ winner: "alice", loser: "bob", playedAt: MONDAY }),
      // A rematch 10 minutes later, and the loser of the first game wins it.
      game({ winner: "bob", loser: "alice", playedAt: MONDAY + 10 * 60 * 1000 }),
      game({ winner: "carol", loser: "dave", playedAt: MONDAY + 2 * HOUR_MS }),
      // The pair meets again, too late to be the same session at the table.
      game({ winner: "alice", loser: "bob", playedAt: MONDAY + 5 * HOUR_MS }),
      game({ winner: "alice", loser: "carol", playedAt: MONDAY + 6 * HOUR_MS }),
    ];

    const stats = gameLevelStats(played)!;

    expect(stats.rematchOfThePair).toBe(40);
    expect(stats.revenge).toBe(100);
    expect(stats.sameSession).toBe(20);
    // Alice is the only winner who won the game she played before.
    expect(stats.winnerWonThePreviousGame).toBeCloseTo(100 / 3);
  });

  it("leaves out the shares that the period holds no game for", () => {
    const stats = gameLevelStats([game({ winner: "alice", loser: "bob" })])!;

    expect(stats.rematchOfThePair).toBe(0);
    expect(stats.sameSession).toBe(0);
    expect(stats.revenge).toBeUndefined();
    expect(stats.winnerWonThePreviousGame).toBeUndefined();
  });
});

describe("setLevelStats", () => {
  it("reports the share of games the loser lost without a set", () => {
    const played = [
      ...games(6, { score: { setsWon: { gameWinner: 2, gameLoser: 0 } } }),
      ...games(4, { score: { setsWon: { gameWinner: 2, gameLoser: 1 } } }),
    ];

    const stats = setLevelStats(played)!;

    expect(stats.whitewash).toBe(60);
    // The loser stopped one set short in the 2-1 games, so the last set decided.
    expect(stats.decider).toBe(40);
    expect(stats.singleSet).toBe(0);
    expect(stats.medianSetsPlayed).toBe(2);
  });

  it("counts a game of one set as a single set and never as a decider", () => {
    const stats = setLevelStats(games(2, { score: { setsWon: { gameWinner: 1, gameLoser: 0 } } }))!;

    expect(stats.singleSet).toBe(100);
    expect(stats.decider).toBe(0);
    expect(stats.whitewash).toBe(100);
    expect(stats.medianSetsPlayed).toBe(1);
  });

  it("stays silent when no game records a set", () => {
    expect(setLevelStats(games(50))).toBeUndefined();
  });
});

describe("pointLevelStats", () => {
  it("stays silent when no game records the points", () => {
    expect(pointLevelStats(games(50, { score: { setsWon: { gameWinner: 2, gameLoser: 0 } } }))).toBeUndefined();
  });

  it("counts a set as a deuce set when both players reach 10", () => {
    const played = games(10, {
      score: {
        setsWon: { gameWinner: 2, gameLoser: 0 },
        setPoints: [
          { gameWinner: 12, gameLoser: 10 },
          { gameWinner: 11, gameLoser: 4 },
        ],
      },
    });

    const stats = pointLevelStats(played)!;

    expect(stats.setsToDeuce).toBe(50);
    expect(stats.medianPointsPerSet).toBe(18.5);
    expect(stats.medianSetMargin).toBe(4.5);
    expect(stats.medianPointsPerGame).toBe(37);
    expect(stats.pointsWonByTheWinner).toBeCloseTo((23 / 37) * 100);
    expect(stats.wonWithFewerPoints).toBe(0);
  });

  it("finds the games the winner won with fewer points than the loser", () => {
    const played = games(1, {
      score: {
        setsWon: { gameWinner: 2, gameLoser: 1 },
        setPoints: [
          { gameWinner: 11, gameLoser: 9 },
          { gameWinner: 2, gameLoser: 11 },
          { gameWinner: 11, gameLoser: 9 },
        ],
      },
    });

    const stats = pointLevelStats(played)!;

    expect(stats.wonWithFewerPoints).toBe(100);
    expect(stats.pointsWonByTheWinner).toBeCloseTo((24 / 53) * 100);
  });
});

describe("trackedShareTrend", () => {
  const tracked = {
    setsWon: { gameWinner: 1, gameLoser: 0 },
    setPoints: [{ gameWinner: 11, gameLoser: 0 }],
    pointSequences: ["WWWWWWWWWWW"],
    tracking: {
      version: 1 as const,
      source: "track-game" as const,
      startedAt: 1,
      pointDeltas: [new Array(11).fill(10)],
      endedAfter: 10,
      firstServers: "W",
      corrections: 0,
    },
  };

  it("plots every month that holds a game", () => {
    const january = games(10, { playedAt: new Date(2024, 0, 5).getTime() }).map((entry, index) => ({
      ...entry,
      playedAt: entry.playedAt + index,
      score: index < 5 ? tracked : undefined,
    }));
    // February holds 2 games, and neither of them is tracked.
    const february = games(2, { playedAt: new Date(2024, 1, 5).getTime() });

    const trend = trackedShareTrend([...january, ...february]);

    expect(trend.map((point) => point.period)).toEqual(["2024-01", "2024-02"]);
    expect(trend[0].share).toBe(50);
    expect(trend[1].share).toBe(0);
  });
});

describe("pairingCoverage", () => {
  const created = (id: string, time: number): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: id },
  });
  const deactivated = (id: string, time: number): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.PLAYER_DEACTIVATED,
    data: null,
  });
  const threePlayers = [created("alice", 1), created("bob", 2), created("carol", 3)];

  it("reports the active players and the ranked players as two series", () => {
    const played = [game({ winner: "alice", loser: "bob" })];

    const coverage = pairingCoverage(played, threePlayers, 1)!;

    // Three active players make three pairs, and one of them has met. The two
    // players with a game make the one ranked pair, and it has met.
    expect(coverage.now.all).toBeCloseTo(33.333);
    expect(coverage.now.ranked).toBe(100);
  });

  it("carries both values on every point of the trend", () => {
    const played = [
      game({ playedAt: new Date(2024, 0, 5).getTime(), winner: "alice", loser: "carol" }),
      game({ playedAt: new Date(2024, 1, 5).getTime(), winner: "alice", loser: "bob" }),
    ];

    const { trend } = pairingCoverage(played, threePlayers, 1)!;

    expect(trend.map((point) => point.period)).toEqual(["2024-01", "2024-02"]);
    // In January only alice and carol have a game, so they are the ranked pair.
    expect(trend[0].all).toBeCloseTo(33.333);
    expect(trend[0].ranked).toBe(100);
    // In February all three are ranked, and two of their three pairs have met.
    expect(trend[1].all).toBeCloseTo(66.667);
    expect(trend[1].ranked).toBeCloseTo(66.667);
  });

  it("measures every month against the players of that month", () => {
    const played = [
      game({ playedAt: new Date(2024, 0, 5).getTime(), winner: "alice", loser: "bob" }),
      game({ playedAt: new Date(2024, 1, 5).getTime(), winner: "alice", loser: "carol" }),
    ];
    // Dave joins in February, so he adds pairs to February and not to January.
    const events = [...threePlayers, created("dave", new Date(2024, 1, 1).getTime())];

    const { trend } = pairingCoverage(played, events, 1)!;

    // January: three players, three pairs, one met.
    expect(trend[0].all).toBeCloseTo(33.333);
    // February: four players, six pairs, two met.
    expect(trend[1].all).toBeCloseTo(33.333);
    expect(trend[1].timestamp).toBe(new Date(2024, 1, 1).getTime());
  });

  it("plots a month that holds no game", () => {
    const played = [
      game({ playedAt: new Date(2024, 0, 5).getTime(), winner: "alice", loser: "bob" }),
      game({ playedAt: new Date(2024, 2, 5).getTime(), winner: "alice", loser: "carol" }),
    ];

    const { trend } = pairingCoverage(played, threePlayers, 1)!;

    expect(trend.map((point) => point.period)).toEqual(["2024-01", "2024-02", "2024-03"]);
    expect(trend[1].all).toBeCloseTo(33.333);
  });

  it("counts a pair once, whichever way round it played", () => {
    const played = [game({ winner: "alice", loser: "bob" }), game({ winner: "bob", loser: "alice" })];

    expect(pairingCoverage(played, threePlayers, 1)!.now.all).toBeCloseTo(33.333);
  });

  it("leaves out a player who is no longer active", () => {
    const played = [game({ winner: "alice", loser: "bob" })];
    const events = [...threePlayers, deactivated("bob", new Date(2024, 5, 1).getTime())];

    // Bob is out, so the pair he played is gone and alice and carol have not met.
    expect(pairingCoverage(played, events, 1)!.now.all).toBe(0);
  });

  it("says nothing when there is no game to measure", () => {
    expect(pairingCoverage([], threePlayers, 1)).toBeUndefined();
  });
});

describe("rankedMix", () => {
  it("splits every game three ways, and the shares add up to 100", () => {
    const ranked = new Set(["alice", "bob"]);
    const played = [
      ...games(2, { winner: "alice", loser: "bob" }),
      ...games(14, { winner: "alice", loser: "carol" }),
    ];

    const mix = rankedMix(played, ranked)!;

    expect(mix.bothRanked + mix.oneRanked + mix.neitherRanked).toBe(100);
    expect(mix.neitherRanked).toBeGreaterThanOrEqual(0);
  });
});

describe("trackedLevelStats", () => {
  it("stays silent when no game is tracked", () => {
    expect(trackedLevelStats(games(50))).toBeUndefined();
  });

  it("reports medians and the share of points won by the server", () => {
    const played = games(1, {
      score: {
        setsWon: { gameWinner: 1, gameLoser: 0 },
        setPoints: [{ gameWinner: 2, gameLoser: 2 }],
        // The server keeps serving for two points, so W served points 1 and 2.
        pointSequences: ["WLWL"],
        tracking: {
          version: 1,
          source: "track-game",
          startedAt: 1,
          pointDeltas: [[50, 100, 100, 100]],
          endedAfter: 10,
          firstServers: "W",
          corrections: 0,
        },
      },
    });

    const stats = trackedLevelStats(played)!;

    expect(stats.medianGameDurationMs).toBe(35_000);
    expect(stats.medianPointGapMs).toBe(10_000);
    expect(stats.pointsWonOnServe).toBe(50);
    // The players take every point from each other, so no point follows a point
    // of the same player, and one set carries no break.
    expect(stats.pointAfterAWonPoint).toBe(0);
    expect(stats.medianSetBreakMs).toBeUndefined();
  });

  it("reads the breaks, the runs and the first point of every set", () => {
    const played = games(1, {
      score: {
        setsWon: { gameWinner: 2, gameLoser: 1 },
        setPoints: [
          { gameWinner: 3, gameLoser: 1 },
          { gameWinner: 1, gameLoser: 3 },
          { gameWinner: 3, gameLoser: 1 },
        ],
        pointSequences: ["WWWL", "WLLL", "LWWW"],
        tracking: {
          version: 1,
          source: "live-game",
          startedAt: 1,
          // The first delta of a set is the break before it.
          pointDeltas: [
            [10, 20, 20, 20],
            [300, 20, 20, 20],
            [600, 20, 20, 20],
          ],
          endedAfter: 10,
          firstServers: "WWW",
          corrections: 0,
        },
      },
    });

    const stats = trackedLevelStats(played)!;

    // Breaks of 30s and 60s before the second and the third set.
    expect(stats.medianSetBreakMs).toBe(45_000);
    // The player who scored the first point won set 1, but lost set 2 and set 3.
    expect(stats.firstPointWinsTheSet).toBeCloseTo((1 / 3) * 100);
    // 2 of the 3 point pairs of each set go to the same player.
    expect(stats.pointAfterAWonPoint).toBeCloseTo((2 / 3) * 100);
  });
});

describe("forEachGameWithPreGameStanding", () => {
  it("reports the rating each player held before the game, not after", () => {
    const players = [player("alice"), player("bob")];
    const played = [
      game({ winner: "alice", loser: "bob", playedAt: MONDAY }),
      game({ winner: "alice", loser: "bob", playedAt: MONDAY + 1 }),
    ];

    const seen: PreGameStanding[] = [];
    forEachGameWithPreGameStanding(played, players, (_, standing) => seen.push(standing));

    // Both start at the initial rating and the first game is an even matchup,
    // so the winner takes half of K and the loser gives up the same.
    expect(seen[0].elo.winner).toBeCloseTo(Elo.INITIAL_ELO);
    expect(seen[0].elo.loser).toBeCloseTo(Elo.INITIAL_ELO);
    expect(seen[1].elo.winner).toBeCloseTo(Elo.INITIAL_ELO + Elo.K / 2);
    expect(seen[1].elo.loser).toBeCloseTo(Elo.INITIAL_ELO - Elo.K / 2);
  });

  it("reports the games each player had played before the game", () => {
    const players = [player("alice"), player("bob")];
    const played = [game({ winner: "alice", loser: "bob" }), game({ winner: "alice", loser: "bob" })];

    const seen: PreGameStanding[] = [];
    forEachGameWithPreGameStanding(played, players, (_, standing) => seen.push(standing));

    expect(seen[0].played).toEqual({ winner: 0, loser: 0 });
    expect(seen[1].played).toEqual({ winner: 1, loser: 1 });
  });
});

describe("ratingGapDistribution", () => {
  const players = [player("alice"), player("bob")];
  const played = games(20, { winner: "alice", loser: "bob" });

  it("gives the wins view and the losses view opposite averages", () => {
    const wins = ratingGapDistribution(played, players, "wins")!;
    const losses = ratingGapDistribution(played, players, "losses")!;

    expect(wins.averageGap).toBeCloseTo(-losses.averageGap);
  });

  it("averages to zero over all games, because each game counts from both sides", () => {
    const all = ratingGapDistribution(played, players, "all")!;

    expect(all.averageGap).toBeCloseTo(0);
  });

  it("measures each group against the most common one", () => {
    const all = ratingGapDistribution(played, players, "all")!;

    expect(Math.max(...all.buckets.map((bucket) => bucket.share))).toBe(100);
  });

  it("keeps zero as the middle group", () => {
    for (const view of ["all", "wins", "losses"] as const) {
      const { buckets } = ratingGapDistribution(played, players, view)!;

      expect(buckets).toHaveLength(buckets.length | 1);
      expect(buckets[Math.floor(buckets.length / 2)].gapGroup).toBe(0);
      expect(buckets[0].gapGroup).toBe(-buckets[buckets.length - 1].gapGroup);
    }
  });

  it("gives the three views the same groups, so a toggle only changes the heights", () => {
    const groupsOf = (view: GapView) =>
      ratingGapDistribution(played, players, view)!.buckets.map((bucket) => bucket.gapGroup);

    expect(groupsOf("wins")).toEqual(groupsOf("all"));
    expect(groupsOf("losses")).toEqual(groupsOf("all"));
  });

  it("makes the wins view and the losses view mirror images", () => {
    const wins = ratingGapDistribution(played, players, "wins")!.buckets;
    const losses = ratingGapDistribution(played, players, "losses")!.buckets;

    expect(wins.map((bucket) => bucket.share)).toEqual([...losses].reverse().map((bucket) => bucket.share));
  });

  it("gives every view on a single game, and nothing on none", () => {
    const one = games(1, { winner: "alice", loser: "bob" });

    expect(ratingGapDistribution(one, players, "all")).toBeDefined();
    expect(ratingGapDistribution(one, players, "wins")).toBeDefined();
    expect(ratingGapDistribution([], players, "all")).toBeUndefined();
  });

  it("reports a share per group and never a count", () => {
    const all = ratingGapDistribution(played, players, "all")!;

    expect(Object.keys(all.buckets[0]).sort()).toEqual(["gapGroup", "share"]);
  });
});

describe("upsetRate", () => {
  const players = [player("alice"), player("bob")];

  /**
   * Alternating winners keeps the two ratings within about 32 points of each
   * other, so every game after the first lands in the group nearest zero. The
   * very first game is an exact tie and drops out.
   */
  const alternating = (count: number): Game[] =>
    Array.from({ length: count }, (_, index) =>
      game(index % 2 === 0 ? { winner: "alice", loser: "bob" } : { winner: "bob", loser: "alice" }),
    );

  it("leaves out a rating gap group that holds too few games", () => {
    // The straight wins at the end open a wider gap, but only for a few games.
    const played = [...alternating(MIN_GAMES_PER_BUCKET + 10), ...games(6, { winner: "alice", loser: "bob" })];

    const rate = upsetRate(played, players)!;

    expect(rate.points.map((point) => point.gapGroup)).toEqual([0]);
  });

  it("expects close to a coin flip when the two ratings are near each other", () => {
    const rate = upsetRate(alternating(MIN_GAMES_PER_BUCKET + 10), players)!;
    const evenGroup = rate.points.find((point) => point.gapGroup === 0)!;

    expect(evenGroup.expected).toBeGreaterThan(40);
    expect(evenGroup.expected).toBeLessThan(50);
  });

  it("counts a win by the lower rated player as an upset", () => {
    // Alternating winners means the player who won the previous game is ahead,
    // so every game is won by the lower rated of the two.
    const rate = upsetRate(alternating(MIN_GAMES_PER_BUCKET + 10), players)!;

    expect(rate.points.find((point) => point.gapGroup === 0)!.actual).toBe(100);
    expect(rate.favouriteWinRate).toBe(0);
  });

  it("ignores a game where the two players are equal on rating and on experience", () => {
    // Every pair debuts against each other, so the two are equal on both.
    const debuts = Array.from({ length: 30 }, (_, index) =>
      game({ winner: `winner-${index}`, loser: `loser-${index}` }),
    );
    const debutPlayers = debuts.flatMap((entry) => [player(entry.winner), player(entry.loser)]);

    expect(upsetRate(debuts, debutPlayers)).toBeUndefined();
  });

});

describe("weakerPlayer", () => {
  const standing = (
    elo: { winner: number; loser: number },
    played: { winner: number; loser: number },
  ): PreGameStanding => ({ elo, played });

  it("picks the lower rated player", () => {
    expect(weakerPlayer(standing({ winner: 900, loser: 1100 }, { winner: 5, loser: 5 }))).toBe("winner");
    expect(weakerPlayer(standing({ winner: 1100, loser: 900 }, { winner: 5, loser: 5 }))).toBe("loser");
  });

  it("falls back to the experience when the two ratings are exactly equal", () => {
    expect(weakerPlayer(standing({ winner: 1000, loser: 1000 }, { winner: 0, loser: 40 }))).toBe("winner");
    expect(weakerPlayer(standing({ winner: 1000, loser: 1000 }, { winner: 40, loser: 0 }))).toBe("loser");
  });

  it("reports no weaker player when the two are equal on both", () => {
    expect(weakerPlayer(standing({ winner: 1000, loser: 1000 }, { winner: 0, loser: 0 }))).toBeUndefined();
  });

  it("lets the rating decide even when the experience points the other way", () => {
    expect(weakerPlayer(standing({ winner: 900, loser: 1100 }, { winner: 99, loser: 1 }))).toBe("winner");
  });
});

describe("rankMovement", () => {
  const summary = (id: string, elo: number, history: { time: number; eloAfterGame: number }[]) => ({
    id,
    elo,
    games: history,
  });

  it("compares only the players who were ranked at both moments", () => {
    const cutoff = 100;
    const movement = rankMovement(
      [
        // Alice fell behind Bob after the cutoff.
        summary("alice", 1000, [
          { time: 50, eloAfterGame: 1100 },
          { time: 150, eloAfterGame: 1000 },
        ]),
        summary("bob", 1100, [
          { time: 50, eloAfterGame: 1000 },
          { time: 150, eloAfterGame: 1100 },
        ]),
        // Carol only became ranked after the cutoff, so she has no earlier place.
        summary("carol", 1050, [{ time: 150, eloAfterGame: 1050 }]),
      ],
      cutoff,
      1,
    );

    expect(movement).toEqual({ moved: 100, climbed: 50, fell: 50 });
  });

  it("stays silent when there is nothing to compare", () => {
    expect(rankMovement([summary("alice", 1000, [{ time: 50, eloAfterGame: 1000 }])], 100, 1)).toBeUndefined();
  });
});

describe("the privacy rule", () => {
  const players = [player("alice"), player("bob")];
  const played = games(MIN_GAMES_PER_BUCKET + 10, { winner: "alice", loser: "bob" });

  it("never names a count in anything an aggregation returns", () => {
    const results: unknown[] = [
      weekdayShares(played),
      timeOfDayShares(played),
      activityTrend(played, "month"),
      detailLevels(played),
      gameLevelStats(played),
      setLevelStats(games(10, { score: { setsWon: { gameWinner: 2, gameLoser: 0 } } })),
      pointLevelStats(
        games(10, {
          score: { setsWon: { gameWinner: 1, gameLoser: 0 }, setPoints: [{ gameWinner: 11, gameLoser: 5 }] },
        }),
      ),
      ratingGapDistribution(played, players, "all"),
      upsetRate(played, players),
    ];

    const forbidden = /count|total|games|players|number/i;
    const keys = new Set<string>();
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(collect);
      if (value === null || typeof value !== "object") return;
      Object.entries(value).forEach(([key, child]) => {
        keys.add(key);
        collect(child);
      });
    };
    results.forEach(collect);

    expect(keys.size).toBeGreaterThan(0);
    expect(Array.from(keys).filter((key) => forbidden.test(key))).toEqual([]);
  });
});
