import { Achievement, GAMES_IN_PERIOD_RECORD_FLOOR } from "../../achievements";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

type GameSpec = { winner: string; loser: string; playedAt: number };

// Timestamps anchored to local noon so every game stays inside its intended
// calendar day regardless of the timezone the tests run in — the achievement
// buckets games by local midnight.
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

function heroAwards(tt: TennisTable, player: string): Extract<Achievement, { type: "hero-of-the-day" }>[] {
  return tt.achievements
    .getAchievements(player)
    .filter(
      (achievement): achievement is Extract<Achievement, { type: "hero-of-the-day" }> =>
        achievement.type === "hero-of-the-day",
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

describe("Hero of the Day achievement", () => {
  it("does not establish a record below the floor", () => {
    const tt = calculate(gamesOnDay(1, "alice", "bob", GAMES_IN_PERIOD_RECORD_FLOOR - 1));

    expect(heroAwards(tt, "alice")).toHaveLength(0);
    expect(heroAwards(tt, "bob")).toHaveLength(0);
    expect(tt.achievements.gamesInDayRecord).toStrictEqual({ count: undefined, holder: undefined });
  });

  it("establishes the first record at the floor, tie going to the winner of the crossing game", () => {
    // Alice and Bob both reach 10 games on the same game; Alice won it.
    const tt = calculate(gamesOnDay(1, "alice", "bob", GAMES_IN_PERIOD_RECORD_FLOOR));

    const aliceAwards = heroAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0]).toStrictEqual({
      type: "hero-of-the-day",
      earnedBy: "alice",
      earnedAt: at(1, GAMES_IN_PERIOD_RECORD_FLOOR - 1),
      earnedByGame: "g2",
      data: {
        day: new Date(2024, 0, 1).getTime(),
        gamesPlayed: GAMES_IN_PERIOD_RECORD_FLOOR,
        previousRecord: undefined,
      },
    });
    expect(heroAwards(tt, "bob")).toHaveLength(0);
    expect(tt.achievements.gamesInDayRecord).toStrictEqual({
      count: GAMES_IN_PERIOD_RECORD_FLOOR,
      holder: "alice",
    });
  });

  it("grows a single award's game count as the record day continues, earned at the record-taking game", () => {
    const tt = calculate(gamesOnDay(1, "alice", "bob", 12));

    // One award: its game count grows to the day's total of 12, but it stays
    // earned at the game that took the record (the floor game).
    const aliceAwards = heroAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0].data.gamesPlayed).toBe(12);
    expect(aliceAwards[0].earnedAt).toBe(at(1, GAMES_IN_PERIOD_RECORD_FLOOR - 1));
    expect(tt.achievements.gamesInDayRecord).toStrictEqual({ count: 12, holder: "alice" });
  });

  it("requires a later day to strictly beat the record", () => {
    const tt = calculate([
      ...gamesOnDay(1, "alice", "bob", 12),
      // Day 2 only ties the record of 12 — no award.
      ...gamesOnDay(2, "alice", "bob", 12),
      // Day 3 beats it with 13.
      ...gamesOnDay(3, "alice", "bob", 13),
    ]);

    const aliceAwards = heroAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(2);
    expect(aliceAwards[1].data).toStrictEqual({
      day: new Date(2024, 0, 3).getTime(),
      gamesPlayed: 13,
      previousRecord: 12,
    });
    expect(tt.achievements.gamesInDayRecord).toStrictEqual({ count: 13, holder: "alice" });
  });

  it("stops growing a taken-over award and starts a fresh one on re-passing", () => {
    const tt = calculate([
      // Day 1: Alice sets the record at 10.
      ...gamesOnDay(1, "alice", "bob", 10),
      // Day 2: Alice takes the record at 11 games...
      ...gamesOnDay(2, "alice", "bob", 11),
      // ...Bob passes her with a 12th game against Carol...
      { winner: "bob", loser: "carol", playedAt: at(2, 20) },
      // ...and Alice re-passes with two more games against Dave: 12 only
      // ties Bob, 13 takes the record back as a NEW award.
      { winner: "alice", loser: "dave", playedAt: at(2, 30) },
      { winner: "alice", loser: "dave", playedAt: at(2, 31) },
    ]);

    const aliceAwards = heroAwards(tt, "alice");
    expect(aliceAwards).toHaveLength(3);
    // The day-2 award taken over by Bob stopped growing at 11.
    expect(aliceAwards[1].data).toStrictEqual({
      day: new Date(2024, 0, 2).getTime(),
      gamesPlayed: 11,
      previousRecord: 10,
    });
    expect(aliceAwards[2].data).toStrictEqual({
      day: new Date(2024, 0, 2).getTime(),
      gamesPlayed: 13,
      previousRecord: 12,
    });

    const bobAwards = heroAwards(tt, "bob");
    expect(bobAwards).toHaveLength(1);
    expect(bobAwards[0].data).toStrictEqual({
      day: new Date(2024, 0, 2).getTime(),
      gamesPlayed: 12,
      previousRecord: 11,
    });

    expect(tt.achievements.gamesInDayRecord).toStrictEqual({ count: 13, holder: "alice" });
  });

  it("reports busiest day, league record and earned count in the progression", () => {
    const tt = calculate([...gamesOnDay(1, "alice", "bob", 10), ...gamesOnDay(2, "alice", "bob", 13)]);

    const alice = tt.achievements.getPlayerProgression("alice")["hero-of-the-day"];
    expect(alice.current).toBe(0); // no games today
    expect(alice.best).toBe(13);
    expect(alice.target).toBe(14); // one beyond the record of 13
    expect(alice.recordHolder).toBe("alice");
    expect(alice.earned).toBe(2);

    const bob = tt.achievements.getPlayerProgression("bob")["hero-of-the-day"];
    expect(bob.best).toBe(13);
    expect(bob.target).toBe(14);
    expect(bob.recordHolder).toBe("alice");
    expect(bob.earned).toBe(0);
  });

  it("leaves the progression target unset until someone holds the record", () => {
    const tt = calculate(gamesOnDay(1, "alice", "bob", GAMES_IN_PERIOD_RECORD_FLOOR - 1));

    const progression = tt.achievements.getPlayerProgression("alice")["hero-of-the-day"];
    expect(progression.target).toBeUndefined();
    expect(progression.recordHolder).toBeUndefined();
    expect(progression.best).toBe(GAMES_IN_PERIOD_RECORD_FLOOR - 1);
    expect(progression.earned).toBe(0);
  });
});
