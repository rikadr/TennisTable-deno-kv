import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Party Pooper: hand an opponent their first loss of a day on which they had
// already won 4 or more games — taking the Perfect Day their next win would
// have earned, or destroying the one they had already secured. Awarded
// immediately, once per opponent per day.

describe("Party Pooper Achievement", () => {
  const baseEvents: EventType[] = [
    { time: 1000, stream: "player-1", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
    { time: 2000, stream: "player-2", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
    { time: 3000, stream: "player-3", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Charlie" } },
  ];

  // Games at 09:00, 10:00, ... on the given local calendar day.
  function winsOnDay(
    year: number,
    month: number,
    day: number,
    winner: string,
    losers: string[],
    streamPrefix: string,
  ): EventType[] {
    return losers.map((loser, i) => {
      const playedAt = new Date(year, month, day, 9 + i).getTime();
      return {
        time: playedAt,
        stream: `${streamPrefix}-${i}`,
        type: EventTypeEnum.GAME_CREATED,
        data: { playedAt, winner, loser },
      };
    });
  }

  function gameAt(year: number, month: number, day: number, hour: number, winner: string, loser: string): EventType {
    const playedAt = new Date(year, month, day, hour).getTime();
    return {
      time: playedAt,
      stream: `g-${winner}-${loser}-${hour}`,
      type: EventTypeEnum.GAME_CREATED,
      data: { playedAt, winner, loser },
    };
  }

  it("awards the winner who hands a 5-0 player their first loss of the day", () => {
    const events: EventType[] = [
      ...baseEvents,
      // Player 1 wins 5 games on Jan 15 (09:00–13:00).
      ...winsOnDay(2024, 0, 15, "player-1", ["player-2", "player-3", "player-2", "player-3", "player-2"], "w"),
      // Player 3 beats player 1 at 15:00 — the perfect day is destroyed.
      gameAt(2024, 0, 15, 15, "player-3", "player-1"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const awards = tt.achievements.getAchievements("player-3").filter((a) => a.type === "party-pooper");
    expect(awards).toHaveLength(1);
    expect(awards[0].data.opponent).toBe("player-1");
    expect(awards[0].data.opponentWins).toBe(5);
    expect(awards[0].data.day).toBe(new Date(2024, 0, 15).getTime());
    expect(awards[0].earnedAt).toBe(new Date(2024, 0, 15, 15).getTime());

    // The spoiled player earns no Perfect Day for that day.
    expect(tt.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-day")).toHaveLength(0);
  });

  it("awards on 4 wins, the win that would have earned the Perfect Day", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...winsOnDay(2024, 0, 15, "player-1", ["player-2", "player-3", "player-2", "player-3"], "w"),
      gameAt(2024, 0, 15, 15, "player-3", "player-1"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const awards = tt.achievements.getAchievements("player-3").filter((a) => a.type === "party-pooper");
    expect(awards).toHaveLength(1);
    expect(awards[0].data.opponentWins).toBe(4);
  });

  it("does NOT award when the opponent had only 3 wins", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...winsOnDay(2024, 0, 15, "player-1", ["player-2", "player-3", "player-2"], "w"),
      gameAt(2024, 0, 15, 15, "player-3", "player-1"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("player-3").filter((a) => a.type === "party-pooper")).toHaveLength(0);
  });

  it("does NOT award when the opponent already lost earlier that day", () => {
    const events: EventType[] = [
      ...baseEvents,
      // Player 1 loses at 08:00, then wins 5 games — no perfect day to spoil.
      gameAt(2024, 0, 15, 8, "player-2", "player-1"),
      ...winsOnDay(2024, 0, 15, "player-1", ["player-2", "player-3", "player-2", "player-3", "player-2"], "w"),
      gameAt(2024, 0, 15, 15, "player-3", "player-1"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("player-3").filter((a) => a.type === "party-pooper")).toHaveLength(0);
  });

  it("does NOT award for a loss on the day AFTER the undefeated day", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...winsOnDay(2024, 0, 15, "player-1", ["player-2", "player-3", "player-2", "player-3", "player-2"], "w"),
      // The loss lands the next morning — the perfect day already stands.
      gameAt(2024, 0, 16, 9, "player-3", "player-1"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("player-3").filter((a) => a.type === "party-pooper")).toHaveLength(0);
    // And the perfect day survives.
    expect(tt.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-day")).toHaveLength(1);
  });

  it("counts wins past 5 — spoiling a 7-0 day records 7 wins", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...winsOnDay(
        2024,
        0,
        15,
        "player-1",
        ["player-2", "player-3", "player-2", "player-3", "player-2", "player-3", "player-2"],
        "w",
      ),
      gameAt(2024, 0, 15, 20, "player-3", "player-1"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const awards = tt.achievements.getAchievements("player-3").filter((a) => a.type === "party-pooper");
    expect(awards).toHaveLength(1);
    expect(awards[0].data.opponentWins).toBe(7);
  });

  it("can be earned twice in one day against two different undefeated players", () => {
    const events: EventType[] = [
      ...baseEvents,
      // Players 1 and 2 each rack up 5 wins against player 3.
      ...winsOnDay(2024, 0, 15, "player-1", ["player-3", "player-3", "player-3", "player-3", "player-3"], "a"),
      ...winsOnDay(2024, 0, 15, "player-2", ["player-3", "player-3", "player-3", "player-3", "player-3"], "b"),
      // Player 3 then beats both of them in the evening.
      gameAt(2024, 0, 15, 20, "player-3", "player-1"),
      gameAt(2024, 0, 15, 21, "player-3", "player-2"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const awards = tt.achievements.getAchievements("player-3").filter((a) => a.type === "party-pooper");
    expect(awards).toHaveLength(2);
    expect(awards.map((a) => a.data.opponent).sort()).toEqual(["player-1", "player-2"]);
  });
});
