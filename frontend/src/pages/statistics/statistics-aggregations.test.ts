import { Game } from "../../client/client-db/event-store/projectors/games-projector";
import { Player } from "../../client/client-db/event-store/projectors/players-projector";
import { Elo } from "../../client/client-db/elo";
import {
  GapView,
  activityTrend,
  detailLevels,
  forEachGameWithPreGameStanding,
  MIN_GAMES_FOR_SHARES,
  MIN_GAMES_PER_BUCKET,
  paceAndServe,
  percent,
  PreGameStanding,
  rankedMix,
  rankMovement,
  ratingGapDistribution,
  scoreShape,
  timeOfDayShares,
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

  it("stays silent below the minimum, so a share cannot be read as a count", () => {
    expect(detailLevels(games(MIN_GAMES_FOR_SHARES - 1, { score: tracked }))).toBeUndefined();
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

describe("scoreShape", () => {
  it("reports the share of games the loser lost without a set", () => {
    const played = [
      ...games(6, { score: { setsWon: { gameWinner: 2, gameLoser: 0 } } }),
      ...games(4, { score: { setsWon: { gameWinner: 2, gameLoser: 1 } } }),
    ];

    const shape = scoreShape(played)!;

    expect(shape.whitewash).toBe(60);
    // No set points recorded, so the point statistics are left out.
    expect(shape.setsToDeuce).toBeUndefined();
    expect(shape.medianPointsPerSet).toBeUndefined();
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

    const shape = scoreShape(played)!;

    expect(shape.setsToDeuce).toBe(50);
    expect(shape.medianPointsPerSet).toBe(18.5);
    expect(shape.medianSetMargin).toBe(4.5);
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

  it("leaves out a month that holds too few games", () => {
    const january = games(MIN_GAMES_FOR_SHARES, { playedAt: new Date(2024, 0, 5).getTime() }).map((entry, index) => ({
      ...entry,
      playedAt: entry.playedAt + index,
      score: index < 5 ? tracked : undefined,
    }));
    // February is under the minimum, so it says nothing rather than 0%.
    const february = games(2, { playedAt: new Date(2024, 1, 5).getTime() });

    const trend = trackedShareTrend([...january, ...february]);

    expect(trend.map((point) => point.period)).toEqual(["2024-01"]);
    expect(trend[0].share).toBe(50);
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

describe("paceAndServe", () => {
  it("stays silent when too few games are tracked", () => {
    expect(paceAndServe(games(50))).toBeUndefined();
  });

  it("reports medians and the share of points won by the server", () => {
    const played = games(MIN_GAMES_FOR_SHARES, {
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

    const pace = paceAndServe(played)!;

    expect(pace.medianGameDurationMs).toBe(35_000);
    expect(pace.medianPointGapMs).toBe(10_000);
    expect(pace.medianPointsPerGame).toBe(4);
    expect(pace.pointsWonOnServe).toBe(50);
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

  it("stays silent below the minimum", () => {
    expect(ratingGapDistribution(games(2), players, "all")).toBeUndefined();
  });

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

  it("counts games and not entries, so the all view needs as many games as the others", () => {
    // The all view takes two entries per game. Counting entries would let this
    // through on half of the minimum.
    const tooFew = games(MIN_GAMES_FOR_SHARES - 1, { winner: "alice", loser: "bob" });

    expect(ratingGapDistribution(tooFew, players, "all")).toBeUndefined();
    expect(ratingGapDistribution(tooFew, players, "wins")).toBeUndefined();
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
      scoreShape(games(10, { score: { setsWon: { gameWinner: 2, gameLoser: 0 } } })),
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
