import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Jan 15 2024 is a Monday, so 15=Mon, 16=Tue, 17=Wed, 18=Thu, 19=Fri,
// 20=Sat, 21=Sun. Jan 22 2024 is the following Monday.
describe("Perfect Week Achievement Tests", () => {
  let baseEvents: EventType[];

  beforeEach(() => {
    baseEvents = [
      { time: 1000, stream: "player-1", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
      { time: 2000, stream: "player-2", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
    ];
  });

  // A win for `winner` at 12:00 on the given local calendar day.
  function win(year: number, month: number, day: number, winner: string, loser: string, stream: string): EventType {
    const playedAt = new Date(year, month, day, 12).getTime();
    return {
      time: playedAt,
      stream,
      type: EventTypeEnum.GAME_CREATED,
      data: { playedAt, winner, loser },
    };
  }

  it("awards perfect-week for a win on every weekday Mon–Fri", () => {
    const events: EventType[] = [
      ...baseEvents,
      win(2024, 0, 15, "player-1", "player-2", "mon"),
      win(2024, 0, 16, "player-1", "player-2", "tue"),
      win(2024, 0, 17, "player-1", "player-2", "wed"),
      win(2024, 0, 18, "player-1", "player-2", "thu"),
      win(2024, 0, 19, "player-1", "player-2", "fri"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(1);
    expect(perfectWeeks[0].data.weekStart).toBe(new Date(2024, 0, 15).getTime());
    // Earned at the Friday win that completed the set.
    expect(perfectWeeks[0].earnedAt).toBe(new Date(2024, 0, 19, 12).getTime());
  });

  it("does NOT award when only Mon–Thu are won", () => {
    const events: EventType[] = [
      ...baseEvents,
      win(2024, 0, 15, "player-1", "player-2", "mon"),
      win(2024, 0, 16, "player-1", "player-2", "tue"),
      win(2024, 0, 17, "player-1", "player-2", "wed"),
      win(2024, 0, 18, "player-1", "player-2", "thu"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(0);
  });

  it("does NOT count weekend wins toward the working week", () => {
    const events: EventType[] = [
      ...baseEvents,
      win(2024, 0, 15, "player-1", "player-2", "mon"),
      win(2024, 0, 16, "player-1", "player-2", "tue"),
      win(2024, 0, 17, "player-1", "player-2", "wed"),
      win(2024, 0, 18, "player-1", "player-2", "thu"),
      // Saturday + Sunday wins — do not substitute for Friday.
      win(2024, 0, 20, "player-1", "player-2", "sat"),
      win(2024, 0, 21, "player-1", "player-2", "sun"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(0);
  });

  it("does NOT award when weekday wins are split across two different weeks", () => {
    const events: EventType[] = [
      ...baseEvents,
      // Week 1: Mon, Tue, Wed
      win(2024, 0, 15, "player-1", "player-2", "w1-mon"),
      win(2024, 0, 16, "player-1", "player-2", "w1-tue"),
      win(2024, 0, 17, "player-1", "player-2", "w1-wed"),
      // Week 2: Thu, Fri
      win(2024, 0, 25, "player-1", "player-2", "w2-thu"),
      win(2024, 0, 26, "player-1", "player-2", "w2-fri"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(0);
  });

  it("awards a separate perfect-week for each qualifying week", () => {
    const events: EventType[] = [
      ...baseEvents,
      // Week of Jan 15
      win(2024, 0, 15, "player-1", "player-2", "w1-mon"),
      win(2024, 0, 16, "player-1", "player-2", "w1-tue"),
      win(2024, 0, 17, "player-1", "player-2", "w1-wed"),
      win(2024, 0, 18, "player-1", "player-2", "w1-thu"),
      win(2024, 0, 19, "player-1", "player-2", "w1-fri"),
      // Week of Jan 22
      win(2024, 0, 22, "player-1", "player-2", "w2-mon"),
      win(2024, 0, 23, "player-1", "player-2", "w2-tue"),
      win(2024, 0, 24, "player-1", "player-2", "w2-wed"),
      win(2024, 0, 25, "player-1", "player-2", "w2-thu"),
      win(2024, 0, 26, "player-1", "player-2", "w2-fri"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(2);
  });

  it("only counts wins, not losses, toward a weekday", () => {
    const events: EventType[] = [
      ...baseEvents,
      win(2024, 0, 15, "player-1", "player-2", "mon"),
      win(2024, 0, 16, "player-1", "player-2", "tue"),
      win(2024, 0, 17, "player-1", "player-2", "wed"),
      win(2024, 0, 18, "player-1", "player-2", "thu"),
      // Friday: player-1 LOSES — does not count as a Friday win.
      win(2024, 0, 19, "player-2", "player-1", "fri"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(0);
  });

  it("tracks progression toward perfect-week (distinct weekdays won)", () => {
    const events: EventType[] = [
      ...baseEvents,
      win(2024, 0, 15, "player-1", "player-2", "mon"),
      win(2024, 0, 17, "player-1", "player-2", "wed"),
      win(2024, 0, 19, "player-1", "player-2", "fri"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const progression = tennisTable.achievements.getPlayerProgression("player-1");
    expect(progression["perfect-week"].current).toBe(3);
    expect(progression["perfect-week"].target).toBe(5);
    expect(progression["perfect-week"].earned).toBe(0);
  });
});
