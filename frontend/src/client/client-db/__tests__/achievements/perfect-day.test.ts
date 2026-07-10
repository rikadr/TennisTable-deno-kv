import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

describe("Perfect Day Achievement Tests", () => {
  let baseEvents: EventType[];

  beforeEach(() => {
    baseEvents = [
      { time: 1000, stream: "player-1", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
      { time: 2000, stream: "player-2", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
      { time: 3000, stream: "player-3", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Charlie" } },
    ];
  });

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

  it("awards perfect-day for 5 undefeated games in a single day", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...winsOnDay(2024, 0, 15, "player-1", ["player-2", "player-3", "player-2", "player-3", "player-2"], "g"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectDays = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-day");
    expect(perfectDays).toHaveLength(1);
    expect(perfectDays[0].data.wins).toBe(5);
    // Earned at the last (5th) win of the day: 09:00 + 4 hours = 13:00.
    expect(perfectDays[0].earnedAt).toBe(new Date(2024, 0, 15, 13).getTime());
  });

  it("does NOT award for only 4 wins in a day", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...winsOnDay(2024, 0, 15, "player-1", ["player-2", "player-3", "player-2", "player-3"], "g"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectDays = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-day");
    expect(perfectDays).toHaveLength(0);
  });

  it("does NOT award if the player loses a game that same day", () => {
    const wins = winsOnDay(2024, 0, 15, "player-1", ["player-2", "player-3", "player-2", "player-3", "player-2"], "g");
    // One loss the same day (17:00).
    const lossAt = new Date(2024, 0, 15, 17).getTime();
    const events: EventType[] = [
      ...baseEvents,
      ...wins,
      {
        time: lossAt,
        stream: "g-loss",
        type: EventTypeEnum.GAME_CREATED,
        data: { playedAt: lossAt, winner: "player-2", loser: "player-1" },
      },
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectDays = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-day");
    expect(perfectDays).toHaveLength(0);
  });

  it("does NOT award when 5 wins are spread across two days", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...winsOnDay(2024, 0, 15, "player-1", ["player-2", "player-3", "player-2"], "d1"),
      ...winsOnDay(2024, 0, 16, "player-1", ["player-3", "player-2"], "d2"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectDays = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-day");
    expect(perfectDays).toHaveLength(0);
  });

  it("awards perfect-day once per qualifying day (earnable multiple times)", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...winsOnDay(2024, 0, 15, "player-1", ["player-2", "player-3", "player-2", "player-3", "player-2"], "d1"),
      ...winsOnDay(2024, 0, 20, "player-1", ["player-3", "player-2", "player-3", "player-2", "player-3"], "d2"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectDays = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-day");
    expect(perfectDays).toHaveLength(2);
  });

  it("tracks progression toward perfect-day (best undefeated day)", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...winsOnDay(2024, 0, 15, "player-1", ["player-2", "player-3", "player-2"], "g"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const progression = tennisTable.achievements.getPlayerProgression("player-1");
    expect(progression["perfect-day"].current).toBe(3);
    expect(progression["perfect-day"].target).toBe(5);
    expect(progression["perfect-day"].earned).toBe(0);
  });
});
