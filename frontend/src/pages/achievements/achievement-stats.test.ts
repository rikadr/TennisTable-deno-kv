import { Achievement, AchievementType } from "../../client/client-db/achievements";
import {
  achievementDetails,
  achievementValue,
  ACHIEVEMENT_METRICS,
  leagueAchievementStats,
  rarityRanking,
  RECORD_ACHIEVEMENTS,
  recordHistory,
  valueBuckets,
} from "./achievement-stats";

const DAY_MS = 24 * 60 * 60 * 1000;
const START = new Date(2024, 0, 1, 12, 0).getTime();

function firstGame(earnedBy: string, earnedAt: number, gameId = "g1"): Achievement {
  return { type: "first-game", earnedBy, earnedAt, data: { gameId, opponent: "bob" } };
}

function heroOfTheDay(earnedBy: string, earnedAt: number, gamesPlayed: number, previousRecord?: number): Achievement {
  return {
    type: "hero-of-the-day",
    earnedBy,
    earnedAt,
    data: { day: earnedAt, gamesPlayed, previousRecord },
  };
}

function shootout(earnedBy: string, earnedAt: number, points: number): Achievement {
  return {
    type: "shootout",
    earnedBy,
    earnedAt,
    data: { gameId: "g1", opponent: "bob", points, sets: [] },
  };
}

describe("rarityRanking", () => {
  const types = ["first-game", "ranked", "donut-5", "retired"] as AchievementType[];

  it("counts the earnings and the players who hold each type", () => {
    const ranking = rarityRanking(
      [firstGame("alice", 1), firstGame("bob", 2), heroOfTheDay("alice", 3, 4)],
      [...types, "hero-of-the-day"] as AchievementType[],
    );

    expect(ranking.get("first-game")).toMatchObject({ earnings: 2, holders: 2 });
    expect(ranking.get("hero-of-the-day")).toMatchObject({ earnings: 1, holders: 1 });
    // A type nobody earned is still ranked, with nothing to its name.
    expect(ranking.get("retired")).toMatchObject({ earnings: 0, holders: 0 });
  });

  it("counts one player twice as one holder", () => {
    const ranking = rarityRanking([heroOfTheDay("alice", 1, 4), heroOfTheDay("alice", 2, 5)], [
      "hero-of-the-day",
    ] as AchievementType[]);

    expect(ranking.get("hero-of-the-day")).toMatchObject({ earnings: 2, holders: 1 });
  });

  it("ranks the rarest first, and reports how many types the rank counts", () => {
    // donut-5: 1 holder, first-game: 2 holders, ranked: 3 holders, retired: 0.
    const ranking = rarityRanking(
      [
        { type: "donut-5", earnedBy: "alice", earnedAt: 1, data: undefined },
        firstGame("alice", 2),
        firstGame("bob", 3),
        { type: "ranked", earnedBy: "alice", earnedAt: 4, data: { gameId: "g", opponent: "bob" } },
        { type: "ranked", earnedBy: "bob", earnedAt: 5, data: { gameId: "g", opponent: "alice" } },
        { type: "ranked", earnedBy: "carol", earnedAt: 6, data: { gameId: "g", opponent: "bob" } },
      ],
      types,
    );

    expect(ranking.get("retired")!.rank).toBe(1);
    expect(ranking.get("donut-5")!.rank).toBe(2);
    expect(ranking.get("first-game")!.rank).toBe(3);
    expect(ranking.get("ranked")!.rank).toBe(4);
    expect(ranking.get("ranked")!.total).toBe(4);
  });

  it("gives a tie the lowest rank of the tie", () => {
    // retired has the fewest holders, so the two types on 2 holders tie on 2.
    const ranking = rarityRanking(
      [
        { type: "retired", earnedBy: "alice", earnedAt: 1, data: undefined },
        firstGame("alice", 2),
        firstGame("bob", 3),
        { type: "ranked", earnedBy: "alice", earnedAt: 4, data: { gameId: "g", opponent: "bob" } },
        { type: "ranked", earnedBy: "bob", earnedAt: 5, data: { gameId: "g", opponent: "alice" } },
      ],
      types,
    );

    expect(ranking.get("donut-5")!.rank).toBe(1);
    expect(ranking.get("retired")!.rank).toBe(2);
    expect(ranking.get("first-game")!.rank).toBe(3);
    expect(ranking.get("ranked")!.rank).toBe(3);
  });
});

describe("achievementValue", () => {
  it("reads the value of the achievements that measure one", () => {
    expect(achievementValue(heroOfTheDay("alice", 1, 7))).toBe(7);
    expect(achievementValue(shootout("alice", 1, 64))).toBe(64);
    expect(
      achievementValue({
        type: "longest-win-streak",
        earnedBy: "alice",
        earnedAt: 1,
        data: { streakLength: 9, startedAt: 0 },
      }),
    ).toBe(9);
    expect(
      achievementValue({
        type: "climber",
        earnedBy: "alice",
        earnedAt: 1,
        data: { fromElo: 1000, toElo: 1120, fromDate: 0, toDate: 1 },
      }),
    ).toBe(120);
  });

  it("reads the widest rank gap of a Giant Hunting day", () => {
    expect(
      achievementValue({
        type: "giant-hunting",
        earnedBy: "alice",
        earnedAt: 1,
        data: {
          day: 0,
          giants: [
            { opponent: "bob", opponentRank: 2, playerRank: 5 },
            { opponent: "carol", opponentRank: 1, playerRank: 9 },
          ],
        },
      }),
    ).toBe(8);
  });

  it("has no value for an achievement that measures nothing", () => {
    expect(achievementValue(firstGame("alice", 1))).toBeUndefined();
    expect(achievementValue({ type: "donut-5", earnedBy: "alice", earnedAt: 1, data: undefined })).toBeUndefined();
  });

  it("names a metric for every achievement that holds a record", () => {
    // The record history renders the value in the unit of its metric, so a
    // record type with no metric would show no history at all.
    RECORD_ACHIEVEMENTS.forEach((type) => expect(ACHIEVEMENT_METRICS[type]).toBeDefined());
  });

  it("names a metric for every type that has a value", () => {
    // A type with a value but no metric would show a number with no unit.
    const withValue: AchievementType[] = [
      "hero-of-the-day",
      "shootout",
      "longest-win-streak",
      "climber",
      "giant-hunting",
    ];
    withValue.forEach((type) => expect(ACHIEVEMENT_METRICS[type]).toBeDefined());
  });
});

describe("recordHistory", () => {
  it("puts the earnings in order, and closes each step when the next one lands", () => {
    const steps = recordHistory([
      heroOfTheDay("alice", START, 4),
      heroOfTheDay("bob", START + 5 * DAY_MS, 6, 4),
      heroOfTheDay("alice", START + 20 * DAY_MS, 8, 6),
    ]);

    expect(steps.map((step) => step.value)).toEqual([4, 6, 8]);
    expect(steps[0].heldUntil).toBe(START + 5 * DAY_MS);
    expect(steps[1].heldUntil).toBe(START + 20 * DAY_MS);
    // The last step is the record that stands.
    expect(steps[2].heldUntil).toBeUndefined();
  });

  it("holds both players of one record in a single step", () => {
    // A Shootout record goes to both players of the game.
    const steps = recordHistory([shootout("alice", START, 64), shootout("bob", START, 64)]);

    expect(steps).toHaveLength(1);
    expect(steps[0].holders).toEqual(["alice", "bob"]);
  });
});

describe("valueBuckets", () => {
  const metric = { label: "Games", format: (value: number) => `${value}` };

  it("gives a bucket to every value while the values are few", () => {
    expect(valueBuckets([3, 3, 4, 6], metric)).toEqual([
      { label: "3", count: 2 },
      { label: "4", count: 1 },
      { label: "6", count: 1 },
    ]);
  });

  it("spreads many values over ranges, and counts every one of them", () => {
    const values = Array.from({ length: 40 }, (_, index) => index);
    const buckets = valueBuckets(values, metric);

    expect(buckets).toHaveLength(8);
    expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(values.length);
  });
});

describe("achievementDetails", () => {
  const allTypes = ["first-game", "hero-of-the-day", "retired"] as AchievementType[];

  function details(achievements: Achievement[], type: AchievementType, now = START + 30 * DAY_MS) {
    return achievementDetails({
      type,
      allAchievements: achievements,
      allTypes,
      playerCount: 4,
      firstGameByPlayer: new Map([
        ["alice", START],
        ["bob", START],
      ]),
      now,
    });
  }

  it("summarises who holds it and when it was last earned", () => {
    const result = details(
      [heroOfTheDay("alice", START + DAY_MS, 4), heroOfTheDay("alice", START + 2 * DAY_MS, 6), heroOfTheDay("bob", START + 10 * DAY_MS, 7)],
      "hero-of-the-day",
    );

    expect(result.rarity.earnings).toBe(3);
    expect(result.rarity.holders).toBe(2);
    expect(result.holderShare).toBe(50);
    expect(result.topHolders[0]).toMatchObject({ playerId: "alice", count: 2 });
    expect(result.first?.earnedAt).toBe(START + DAY_MS);
    expect(result.latest?.earnedAt).toBe(START + 10 * DAY_MS);
    expect(result.daysSinceLatest).toBe(20);
    expect(result.isReachievable).toBe(true);
  });

  it("counts the last earning in calendar days, not in elapsed time", () => {
    const lastNight = new Date(2024, 0, 10, 23, 0).getTime();
    const thisMorning = new Date(2024, 0, 11, 9, 0).getTime();

    // 10 hours apart, but one calendar day: the earning was yesterday.
    const result = details([heroOfTheDay("alice", lastNight, 4)], "hero-of-the-day", thisMorning);
    expect(result.daysSinceLatest).toBe(1);

    // Earlier the same day is still today, however many hours ago it was.
    const earlierToday = new Date(2024, 0, 11, 1, 0).getTime();
    expect(details([heroOfTheDay("alice", earlierToday, 4)], "hero-of-the-day", thisMorning).daysSinceLatest).toBe(0);
  });

  it("measures the time from a player's first game to their first earning", () => {
    const result = details(
      [heroOfTheDay("alice", START + 4 * DAY_MS, 4), heroOfTheDay("bob", START + 10 * DAY_MS, 5)],
      "hero-of-the-day",
    );

    expect(result.timeToEarn).toMatchObject({
      medianDays: 7,
      fastest: { playerId: "alice", days: 4 },
      slowest: { playerId: "bob", days: 10 },
    });
  });

  it("shows no time to earn for an achievement earned in a player's first game", () => {
    // Every span is 0 days, which says nothing about the achievement.
    const result = details([firstGame("alice", START), firstGame("bob", START)], "first-game");

    expect(result.timeToEarn).toBeUndefined();
  });

  it("counts a month with no earning between two that have one", () => {
    const result = details(
      [heroOfTheDay("alice", new Date(2024, 0, 15).getTime(), 4), heroOfTheDay("alice", new Date(2024, 2, 15).getTime(), 6)],
      "hero-of-the-day",
    );

    expect(result.perMonth.map((bucket) => bucket.count)).toEqual([1, 0, 1]);
  });

  it("holds nothing but the counts for an achievement nobody earned", () => {
    const result = details([firstGame("alice", START)], "retired");

    expect(result.rarity.earnings).toBe(0);
    expect(result.first).toBeUndefined();
    expect(result.daysSinceLatest).toBeUndefined();
    expect(result.values).toBeUndefined();
    expect(result.topHolders).toEqual([]);
  });

  it("has no record history for an achievement that holds no record", () => {
    expect(details([firstGame("alice", START)], "first-game").recordHistory).toBeUndefined();
    expect(details([heroOfTheDay("alice", START, 4)], "hero-of-the-day").recordHistory).toHaveLength(1);
  });
});

describe("leagueAchievementStats", () => {
  const allTypes = ["first-game", "hero-of-the-day", "retired", "donut-5"] as AchievementType[];

  it("counts the earnings, the types earned and the players who hold one", () => {
    const stats = leagueAchievementStats({
      allAchievements: [firstGame("alice", 1), firstGame("bob", 2), heroOfTheDay("alice", 3, 4)],
      allTypes,
    });

    expect(stats.totalEarnings).toBe(3);
    expect(stats.earnedTypes).toBe(2);
    expect(stats.totalTypes).toBe(4);
    expect(stats.playersWithAchievements).toBe(2);
    expect(stats.neverEarned).toEqual(["retired", "donut-5"]);
  });

  it("ranks the rarest and the most common of the types that were earned", () => {
    const stats = leagueAchievementStats({
      allAchievements: [firstGame("alice", 1), firstGame("bob", 2), heroOfTheDay("alice", 3, 4)],
      allTypes,
    });

    expect(stats.rarest[0].type).toBe("hero-of-the-day");
    expect(stats.mostCommon[0].type).toBe("first-game");
  });

  it("orders the players by the types they hold, then by their earnings", () => {
    const stats = leagueAchievementStats({
      allAchievements: [
        firstGame("alice", 1),
        heroOfTheDay("alice", 2, 4),
        firstGame("bob", 3),
        heroOfTheDay("bob", 4, 5),
        heroOfTheDay("bob", 5, 6),
      ],
      allTypes,
    });

    expect(stats.topPlayers).toEqual([
      { playerId: "bob", types: 2, earnings: 3 },
      { playerId: "alice", types: 2, earnings: 2 },
    ]);
  });
});
