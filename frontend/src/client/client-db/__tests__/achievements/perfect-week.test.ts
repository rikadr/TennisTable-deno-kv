import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { Achievement } from "../../achievements";

// Perfect Week: a Winning Week (a win on each of 5 consecutive days in the
// same Monday-start week) with zero losses in the whole week. Awarded only
// after the week ends, stamped at the end of the week and linked to the last
// win of the week.
//
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

  afterEach(() => {
    jest.useRealTimers();
  });

  // A game won by `winner` on the given local calendar day and hour.
  function win(day: number, winner: string, loser: string, stream: string, hour = 12): EventType {
    const playedAt = new Date(2024, 0, day, hour).getTime();
    return {
      time: playedAt,
      stream,
      type: EventTypeEnum.GAME_CREATED,
      data: { playedAt, winner, loser },
    };
  }

  const monToFriWins = (): EventType[] => [
    win(15, "player-1", "player-2", "mon"),
    win(16, "player-1", "player-2", "tue"),
    win(17, "player-1", "player-2", "wed"),
    win(18, "player-1", "player-2", "thu"),
    win(19, "player-1", "player-2", "fri"),
  ];

  function achievementsOf<T extends "perfect-week" | "winning-week">(
    events: EventType[],
    type: T,
    referenceTime?: number,
  ): Extract<Achievement, { type: T }>[] {
    const tennisTable = new TennisTable({ events, referenceTime });
    tennisTable.achievements.calculateAchievements();
    return tennisTable.achievements
      .getAchievements("player-1")
      .filter((a): a is Extract<Achievement, { type: T }> => a.type === type);
  }

  it("awards perfect-week for an undefeated week with 5 consecutive won days", () => {
    const events: EventType[] = [...baseEvents, ...monToFriWins(), win(19, "player-1", "player-2", "fri-2", 15)];

    const perfectWeeks = achievementsOf(events, "perfect-week");
    expect(perfectWeeks).toHaveLength(1);
    expect(perfectWeeks[0].data.weekStart).toBe(new Date(2024, 0, 15).getTime());
    expect(perfectWeeks[0].data.startDay).toBe(new Date(2024, 0, 15).getTime());
    expect(perfectWeeks[0].data.wins).toBe(6);
    // Stamped at the end of the week, when it is awarded, and linked to the
    // last win of the week.
    expect(perfectWeeks[0].earnedAt).toBe(new Date(2024, 0, 22).getTime());
    expect(perfectWeeks[0].earnedByGame).toBe("fri-2");
  });

  it("does NOT award perfect-week when the player lost a game on a run day, but awards winning-week", () => {
    const events: EventType[] = [...baseEvents, ...monToFriWins(), win(17, "player-2", "player-1", "wed-loss", 15)];

    expect(achievementsOf(events, "perfect-week")).toHaveLength(0);
    expect(achievementsOf(events, "winning-week")).toHaveLength(1);
  });

  it("does NOT award perfect-week when the player lost a game outside the run, in the same week", () => {
    const events: EventType[] = [...baseEvents, ...monToFriWins(), win(21, "player-2", "player-1", "sun-loss")];

    expect(achievementsOf(events, "perfect-week")).toHaveLength(0);
    expect(achievementsOf(events, "winning-week")).toHaveLength(1);
  });

  it("ignores losses in other weeks", () => {
    const events: EventType[] = [
      ...baseEvents,
      win(14, "player-2", "player-1", "prev-sun-loss"),
      ...monToFriWins(),
      win(22, "player-2", "player-1", "next-mon-loss"),
    ];

    expect(achievementsOf(events, "perfect-week")).toHaveLength(1);
  });

  it("does NOT award perfect-week before the week has ended", () => {
    // "now" is Saturday: the week is undefeated so far, but a loss on
    // Saturday or Sunday can still disqualify it.
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2024, 0, 20, 10));

    const events: EventType[] = [...baseEvents, ...monToFriWins()];

    expect(achievementsOf(events, "perfect-week")).toHaveLength(0);
    expect(achievementsOf(events, "winning-week")).toHaveLength(1);
  });

  it("awards perfect-week once the week has ended", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2024, 0, 22, 0, 1));

    const events: EventType[] = [...baseEvents, ...monToFriWins()];

    expect(achievementsOf(events, "perfect-week")).toHaveLength(1);
  });

  it("follows the reference time of a projection of a past state", () => {
    // The live clock is long after the week, but the projection is of Saturday.
    const events: EventType[] = [...baseEvents, ...monToFriWins()];

    expect(achievementsOf(events, "perfect-week", new Date(2024, 0, 20, 10).getTime())).toHaveLength(0);
    expect(achievementsOf(events, "winning-week", new Date(2024, 0, 20, 10).getTime())).toHaveLength(1);
    expect(achievementsOf(events, "perfect-week", new Date(2024, 0, 22).getTime())).toHaveLength(1);
  });

  describe("Progression", () => {
    it("tracks this week's run while the player is undefeated", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 0, 17, 18));

      const events: EventType[] = [
        ...baseEvents,
        win(15, "player-1", "player-2", "mon"),
        win(16, "player-1", "player-2", "tue"),
        win(17, "player-1", "player-2", "wed"),
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();
      const progression = tennisTable.achievements.getPlayerProgression("player-1");
      expect(progression["perfect-week"].current).toBe(3);
      expect(progression["perfect-week"].target).toBe(5);
      expect(progression["winning-week"].current).toBe(3);
    });

    it("drops to 0 after a loss this week, while winning-week keeps the run", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 0, 17, 18));

      const events: EventType[] = [
        ...baseEvents,
        win(15, "player-1", "player-2", "mon"),
        win(16, "player-1", "player-2", "tue"),
        win(17, "player-1", "player-2", "wed"),
        win(17, "player-2", "player-1", "wed-loss", 15),
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();
      const progression = tennisTable.achievements.getPlayerProgression("player-1");
      expect(progression["perfect-week"].current).toBe(0);
      expect(progression["winning-week"].current).toBe(3);
    });

    it("keeps the best run of an undefeated week as the best value", () => {
      // Week of Jan 15: Mon–Thu won, undefeated. Week of Jan 22: Mon–Fri won,
      // with a loss. "now" is the Monday after that.
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 0, 29, 8));

      const events: EventType[] = [
        ...baseEvents,
        win(15, "player-1", "player-2", "w1-mon"),
        win(16, "player-1", "player-2", "w1-tue"),
        win(17, "player-1", "player-2", "w1-wed"),
        win(18, "player-1", "player-2", "w1-thu"),
        win(22, "player-1", "player-2", "w2-mon"),
        win(23, "player-1", "player-2", "w2-tue"),
        win(24, "player-1", "player-2", "w2-wed"),
        win(25, "player-1", "player-2", "w2-thu"),
        win(26, "player-1", "player-2", "w2-fri"),
        win(26, "player-2", "player-1", "w2-fri-loss", 15),
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();
      const progression = tennisTable.achievements.getPlayerProgression("player-1");
      expect(progression["perfect-week"].current).toBe(0);
      expect(progression["perfect-week"].best).toBe(4);
      expect(progression["winning-week"].best).toBe(5);
    });
  });
});
