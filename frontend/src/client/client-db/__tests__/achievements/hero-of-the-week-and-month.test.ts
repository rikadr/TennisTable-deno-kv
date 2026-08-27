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

function calculate(games: GameSpec[]): TennisTable {
  const tt = new TennisTable({ events: eventsForGames(games) });
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

  it("establishes the first record accumulated across the days of a week, tie going to the winner", () => {
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
      data: {
        weekStart: new Date(2024, 0, 1).getTime(),
        gamesPlayed: GAMES_IN_PERIOD_RECORD_FLOOR,
        previousRecord: undefined,
      },
    });
    expect(weekAwards(tt, "bob")).toHaveLength(0);
    expect(tt.achievements.gamesInWeekRecord).toStrictEqual({
      count: GAMES_IN_PERIOD_RECORD_FLOOR,
      holder: "alice",
    });
  });

  it("pins the single award at the record-taking game while the record week grows the record", () => {
    const tt = calculate([...gamesOnDay(1, "alice", "bob", 6), ...gamesOnDay(5, "alice", "bob", 6)]);

    // The award stays at the game that took the record (the floor game);
    // the rest of the record week only grows the record to beat.
    const aliceAwards = weekAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0].data.gamesPlayed).toBe(GAMES_IN_PERIOD_RECORD_FLOOR);
    expect(aliceAwards[0].earnedAt).toBe(at(1, GAMES_IN_PERIOD_RECORD_FLOOR - 1));
    expect(tt.achievements.gamesInWeekRecord).toStrictEqual({ count: 12, holder: "alice" });
  });

  it("resets the count at the week boundary and requires strictly beating the record", () => {
    const tt = calculate([
      // Week of Jan 1: record set and grown to 10.
      ...gamesOnDay(1, "alice", "bob", 10),
      // Week of Jan 8: 10 games only tie the record — no award...
      ...gamesOnDay(8, "alice", "bob", 10),
      // ...an 11th game in the same week takes it.
      { winner: "alice", loser: "bob", playedAt: at(9, 0) },
    ]);

    const aliceAwards = weekAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(2);
    expect(aliceAwards[1].data).toStrictEqual({
      weekStart: new Date(2024, 0, 8).getTime(),
      gamesPlayed: 11,
      previousRecord: 10,
    });
    expect(weekAwards(tt, "bob")).toHaveLength(0);
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
    expect(alice.target).toBe(14); // one beyond the record of 13
    expect(alice.recordHolder).toBe("alice");
    expect(alice.earned).toBe(2);

    const bob = tt.achievements.getPlayerProgression("bob")["hero-of-the-week"];
    expect(bob.best).toBe(13);
    expect(bob.target).toBe(14);
    expect(bob.recordHolder).toBe("alice");
    expect(bob.earned).toBe(0);
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

  it("establishes the first record accumulated across the weeks of a month, tie going to the winner", () => {
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
      data: {
        monthStart: new Date(2024, 0, 1).getTime(),
        gamesPlayed: GAMES_IN_PERIOD_RECORD_FLOOR,
        previousRecord: undefined,
      },
    });
    expect(monthAwards(tt, "bob")).toHaveLength(0);
    expect(tt.achievements.gamesInMonthRecord).toStrictEqual({
      count: GAMES_IN_PERIOD_RECORD_FLOOR,
      holder: "alice",
    });
  });

  it("pins the single award at the record-taking game while the record month grows the record", () => {
    const tt = calculate([...gamesOnDay(1, "alice", "bob", 10), ...gamesOnDay(15, "alice", "bob", 10)]);

    // The award stays at the game that took the record (the floor game);
    // the rest of the record month only grows the record to beat.
    const aliceAwards = monthAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0].data.gamesPlayed).toBe(GAMES_IN_PERIOD_RECORD_FLOOR);
    expect(aliceAwards[0].earnedAt).toBe(at(1, GAMES_IN_PERIOD_RECORD_FLOOR - 1));
    expect(tt.achievements.gamesInMonthRecord).toStrictEqual({ count: 20, holder: "alice" });
  });

  it("resets the count at the month boundary and requires strictly beating the record", () => {
    const tt = calculate([
      // January: record set and grown to 20.
      ...gamesOnDay(1, "alice", "bob", 10),
      ...gamesOnDay(15, "alice", "bob", 10),
      // February (day 32 = Feb 1): 20 games only tie the record — no award...
      ...gamesOnDay(32, "alice", "bob", 10),
      ...gamesOnDay(40, "alice", "bob", 10),
      // ...a 21st game in the same month takes it.
      { winner: "alice", loser: "bob", playedAt: at(41, 0) },
    ]);

    const aliceAwards = monthAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(2);
    expect(aliceAwards[1].data).toStrictEqual({
      monthStart: new Date(2024, 1, 1).getTime(),
      gamesPlayed: 21,
      previousRecord: 20,
    });
    expect(monthAwards(tt, "bob")).toHaveLength(0);
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
    expect(alice.target).toBe(26); // one beyond the record of 25
    expect(alice.recordHolder).toBe("alice");
    expect(alice.earned).toBe(2);

    const bob = tt.achievements.getPlayerProgression("bob")["hero-of-the-month"];
    expect(bob.best).toBe(25);
    expect(bob.target).toBe(26);
    expect(bob.recordHolder).toBe("alice");
    expect(bob.earned).toBe(0);
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
