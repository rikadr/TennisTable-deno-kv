import { Achievement, GAMES_IN_PERIOD_RECORD_FLOOR } from "../../achievements";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

type GameSpec = { winner: string; loser: string; playedAt: number };

// Timestamps anchored to local noon so every game stays inside its intended
// calendar day regardless of the timezone the tests run in — the achievements
// bucket games by local midnight. January 2024 starts on a Monday, so day 1–7
// is one week, day 8 starts the next, and day 32 rolls into February.
function at(day: number, minute: number): number {
  return new Date(2024, 0, day, 12, minute).getTime();
}

function eventsForGames(games: GameSpec[]): EventType[] {
  const players = Array.from(new Set(games.flatMap((game) => [game.winner, game.loser])));
  return [
    ...players.map<EventType>((player, index) => ({
      type: EventTypeEnum.PLAYER_CREATED,
      stream: player,
      time: index + 1,
      data: { name: player },
    })),
    ...games.map<EventType>((game, index) => ({
      type: EventTypeEnum.GAME_CREATED,
      stream: `g${index}`,
      time: game.playedAt,
      data: { winner: game.winner, loser: game.loser, playedAt: game.playedAt },
    })),
  ];
}

// The league's first game, in an earlier month, so the grace period is over
// before the games of a test start.
const leagueStart: EventType[] = [
  { type: EventTypeEnum.PLAYER_CREATED, stream: "opener-1", time: 1000, data: { name: "opener-1" } },
  { type: EventTypeEnum.PLAYER_CREATED, stream: "opener-2", time: 1001, data: { name: "opener-2" } },
  {
    type: EventTypeEnum.GAME_CREATED,
    stream: "opener",
    time: new Date(2023, 10, 1, 12).getTime(),
    data: { winner: "opener-1", loser: "opener-2", playedAt: new Date(2023, 10, 1, 12).getTime() },
  },
];

function calculate(games: GameSpec[], { afterGracePeriod = true } = {}): TennisTable {
  const events = eventsForGames(games);
  const tt = new TennisTable({ events: afterGracePeriod ? [...leagueStart, ...events] : events });
  tt.achievements.calculateAchievements();
  return tt;
}

function weekAwards(tt: TennisTable, player: string): Extract<Achievement, { type: "hero-of-the-week" }>[] {
  return tt.achievements
    .getAchievements(player)
    .filter(
      (achievement): achievement is Extract<Achievement, { type: "hero-of-the-week" }> =>
        achievement.type === "hero-of-the-week",
    );
}

function monthAwards(tt: TennisTable, player: string): Extract<Achievement, { type: "hero-of-the-month" }>[] {
  return tt.achievements
    .getAchievements(player)
    .filter(
      (achievement): achievement is Extract<Achievement, { type: "hero-of-the-month" }> =>
        achievement.type === "hero-of-the-month",
    );
}

/** `count` games between the two players on `day`, all won by `winner`. */
function gamesOnDay(day: number, winner: string, loser: string, count: number, fromMinute = 0): GameSpec[] {
  return Array.from({ length: count }, (_, index) => ({
    winner,
    loser,
    playedAt: at(day, fromMinute + index),
  }));
}

describe("Hero of the Week achievement", () => {
  it("does not establish a record below the floor", () => {
    const tt = calculate(gamesOnDay(1, "alice", "bob", GAMES_IN_PERIOD_RECORD_FLOOR - 1));

    expect(weekAwards(tt, "alice")).toHaveLength(0);
    expect(weekAwards(tt, "bob")).toHaveLength(0);
    expect(tt.achievements.gamesInWeekRecord).toStrictEqual({ count: undefined, holder: undefined });
  });

  it("establishes the first record accumulated across the days of a week, earned by both players", () => {
    // 2 games on Monday + 1 on Wednesday reach the floor of 3 mid-week.
    const tt = calculate([
      ...gamesOnDay(1, "alice", "bob", GAMES_IN_PERIOD_RECORD_FLOOR - 1),
      ...gamesOnDay(3, "alice", "bob", 1),
    ]);

    const aliceAwards = weekAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0]).toStrictEqual({
      type: "hero-of-the-week",
      earnedBy: "alice",
      earnedAt: at(3, 0),
      earnedByGame: "g2",
      data: {
        weekStart: new Date(2024, 0, 1).getTime(),
        gamesPlayed: GAMES_IN_PERIOD_RECORD_FLOOR,
        previousRecord: undefined,
      },
    });
    // Bob reached the floor in the same game. Alice won it, so she holds the
    // record.
    expect(weekAwards(tt, "bob").map((award) => award.data)).toStrictEqual([aliceAwards[0].data]);
    expect(tt.achievements.gamesInWeekRecord).toStrictEqual({
      count: GAMES_IN_PERIOD_RECORD_FLOOR,
      holder: "alice",
    });
  });

  it("grows a single award's game count as the record week continues, earned at the record-taking game", () => {
    const tt = calculate([...gamesOnDay(1, "alice", "bob", 6), ...gamesOnDay(5, "alice", "bob", 6)]);

    // One award: its game count grows to the week's total of 12, but it stays
    // earned at the game that took the record (the floor game).
    const aliceAwards = weekAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0].data.gamesPlayed).toBe(12);
    expect(aliceAwards[0].earnedAt).toBe(at(1, GAMES_IN_PERIOD_RECORD_FLOOR - 1));
    expect(tt.achievements.gamesInWeekRecord).toStrictEqual({ count: 12, holder: "alice" });
  });

  it("resets the count at the week boundary and awards a week that ties the record", () => {
    const tt = calculate([
      // Week of Jan 1: record set and grown to 10.
      ...gamesOnDay(1, "alice", "bob", 10),
      // Week of Jan 8: 10 games tie the record — a new award...
      ...gamesOnDay(8, "alice", "bob", 10),
      // ...that grows when an 11th game in the same week passes it.
      { winner: "alice", loser: "bob", playedAt: at(9, 0) },
    ]);

    const aliceAwards = weekAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(2);
    expect(aliceAwards[1].data).toStrictEqual({
      weekStart: new Date(2024, 0, 8).getTime(),
      gamesPlayed: 11,
      previousRecord: 10,
    });
    expect(aliceAwards[1].earnedAt).toBe(at(8, 9));
    expect(weekAwards(tt, "bob")).toHaveLength(2);
    expect(tt.achievements.gamesInWeekRecord).toStrictEqual({ count: 11, holder: "alice" });
  });

  it("reports busiest week, league record and earned count in the progression", () => {
    const tt = calculate([
      ...gamesOnDay(1, "alice", "bob", 10),
      ...gamesOnDay(8, "alice", "bob", 6),
      ...gamesOnDay(9, "alice", "bob", 7),
    ]);

    const alice = tt.achievements.getPlayerProgression("alice")["hero-of-the-week"];
    expect(alice.current).toBe(0); // no games this week
    expect(alice.best).toBe(13);
    expect(alice.target).toBe(13); // the record
    expect(alice.recordHolder).toBe("alice");
    expect(alice.earned).toBe(2);

    const bob = tt.achievements.getPlayerProgression("bob")["hero-of-the-week"];
    expect(bob.best).toBe(13);
    expect(bob.target).toBe(13);
    expect(bob.recordHolder).toBe("alice");
    // Bob reached the same counts in the same games, so he earned both too.
    expect(bob.earned).toBe(2);
  });

  it("leaves the progression target unset until someone holds the record", () => {
    const tt = calculate(gamesOnDay(1, "alice", "bob", GAMES_IN_PERIOD_RECORD_FLOOR - 1));

    const progression = tt.achievements.getPlayerProgression("alice")["hero-of-the-week"];
    expect(progression.target).toBeUndefined();
    expect(progression.recordHolder).toBeUndefined();
    expect(progression.best).toBe(GAMES_IN_PERIOD_RECORD_FLOOR - 1);
    expect(progression.earned).toBe(0);
  });
});

describe("Hero of the Month achievement", () => {
  it("does not establish a record below the floor", () => {
    const tt = calculate(gamesOnDay(1, "alice", "bob", GAMES_IN_PERIOD_RECORD_FLOOR - 1));

    expect(monthAwards(tt, "alice")).toHaveLength(0);
    expect(monthAwards(tt, "bob")).toHaveLength(0);
    expect(tt.achievements.gamesInMonthRecord).toStrictEqual({ count: undefined, holder: undefined });
  });

  it("establishes the first record accumulated across the weeks of a month, earned by both players", () => {
    // 2 games in the first week + 1 in the third reach the floor of 3.
    const tt = calculate([
      ...gamesOnDay(1, "alice", "bob", GAMES_IN_PERIOD_RECORD_FLOOR - 1),
      ...gamesOnDay(15, "alice", "bob", 1),
    ]);

    const aliceAwards = monthAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0]).toStrictEqual({
      type: "hero-of-the-month",
      earnedBy: "alice",
      earnedAt: at(15, 0),
      earnedByGame: "g2",
      data: {
        monthStart: new Date(2024, 0, 1).getTime(),
        gamesPlayed: GAMES_IN_PERIOD_RECORD_FLOOR,
        previousRecord: undefined,
      },
    });
    // Bob reached the floor in the same game. Alice won it, so she holds the
    // record.
    expect(monthAwards(tt, "bob").map((award) => award.data)).toStrictEqual([aliceAwards[0].data]);
    expect(tt.achievements.gamesInMonthRecord).toStrictEqual({
      count: GAMES_IN_PERIOD_RECORD_FLOOR,
      holder: "alice",
    });
  });

  it("grows a single award's game count as the record month continues, earned at the record-taking game", () => {
    const tt = calculate([...gamesOnDay(1, "alice", "bob", 10), ...gamesOnDay(15, "alice", "bob", 10)]);

    // One award: its game count grows to the month's total of 20, but it
    // stays earned at the game that took the record (the floor game).
    const aliceAwards = monthAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0].data.gamesPlayed).toBe(20);
    expect(aliceAwards[0].earnedAt).toBe(at(1, GAMES_IN_PERIOD_RECORD_FLOOR - 1));
    expect(tt.achievements.gamesInMonthRecord).toStrictEqual({ count: 20, holder: "alice" });
  });

  it("resets the count at the month boundary and awards a month that ties the record", () => {
    const tt = calculate([
      // January: record set and grown to 20.
      ...gamesOnDay(1, "alice", "bob", 10),
      ...gamesOnDay(15, "alice", "bob", 10),
      // February (day 32 = Feb 1): 20 games tie the record — a new award...
      ...gamesOnDay(32, "alice", "bob", 10),
      ...gamesOnDay(40, "alice", "bob", 10),
      // ...that grows when a 21st game in the same month passes it.
      { winner: "alice", loser: "bob", playedAt: at(41, 0) },
    ]);

    const aliceAwards = monthAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(2);
    expect(aliceAwards[1].data).toStrictEqual({
      monthStart: new Date(2024, 1, 1).getTime(),
      gamesPlayed: 21,
      previousRecord: 20,
    });
    expect(aliceAwards[1].earnedAt).toBe(at(40, 9));
    expect(monthAwards(tt, "bob")).toHaveLength(2);
    expect(tt.achievements.gamesInMonthRecord).toStrictEqual({ count: 21, holder: "alice" });
  });

  it("reports busiest month, league record and earned count in the progression", () => {
    const tt = calculate([
      ...gamesOnDay(1, "alice", "bob", 10),
      ...gamesOnDay(15, "alice", "bob", 10),
      ...gamesOnDay(32, "alice", "bob", 13),
      ...gamesOnDay(33, "alice", "bob", 12),
    ]);

    const alice = tt.achievements.getPlayerProgression("alice")["hero-of-the-month"];
    expect(alice.current).toBe(0); // no games this month
    expect(alice.best).toBe(25);
    expect(alice.target).toBe(25); // the record
    expect(alice.recordHolder).toBe("alice");
    expect(alice.earned).toBe(2);

    const bob = tt.achievements.getPlayerProgression("bob")["hero-of-the-month"];
    expect(bob.best).toBe(25);
    expect(bob.target).toBe(25);
    expect(bob.recordHolder).toBe("alice");
    // Bob reached the same counts in the same games, so he earned both too.
    expect(bob.earned).toBe(2);
  });

  it("leaves the progression target unset until someone holds the record", () => {
    const tt = calculate(gamesOnDay(1, "alice", "bob", GAMES_IN_PERIOD_RECORD_FLOOR - 1));

    const progression = tt.achievements.getPlayerProgression("alice")["hero-of-the-month"];
    expect(progression.target).toBeUndefined();
    expect(progression.recordHolder).toBeUndefined();
    expect(progression.best).toBe(GAMES_IN_PERIOD_RECORD_FLOOR - 1);
    expect(progression.earned).toBe(0);
  });
});
