import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Perfect Week: win a game on each of 5 consecutive calendar days, all
// within the same Monday-start week — Mon–Fri, Tue–Sat or Wed–Sun. A run
// crossing a week boundary does not count, and each week awards at most once.
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

  it("awards perfect-week for wins on Mon–Fri", () => {
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
    expect(perfectWeeks[0].data.startDay).toBe(new Date(2024, 0, 15).getTime());
    // Earned at the Friday win that completed the run.
    expect(perfectWeeks[0].earnedAt).toBe(new Date(2024, 0, 19, 12).getTime());
  });

  it("awards perfect-week for wins on Wed–Sun (weekend days count)", () => {
    const events: EventType[] = [
      ...baseEvents,
      win(2024, 0, 17, "player-1", "player-2", "wed"),
      win(2024, 0, 18, "player-1", "player-2", "thu"),
      win(2024, 0, 19, "player-1", "player-2", "fri"),
      win(2024, 0, 20, "player-1", "player-2", "sat"),
      win(2024, 0, 21, "player-1", "player-2", "sun"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(1);
    expect(perfectWeeks[0].data.weekStart).toBe(new Date(2024, 0, 15).getTime());
    expect(perfectWeeks[0].data.startDay).toBe(new Date(2024, 0, 17).getTime());
    expect(perfectWeeks[0].earnedAt).toBe(new Date(2024, 0, 21, 12).getTime());
  });

  it("does NOT award for 5 consecutive days crossing a week boundary (Fri–Tue)", () => {
    const events: EventType[] = [
      ...baseEvents,
      win(2024, 0, 19, "player-1", "player-2", "fri"),
      win(2024, 0, 20, "player-1", "player-2", "sat"),
      win(2024, 0, 21, "player-1", "player-2", "sun"),
      win(2024, 0, 22, "player-1", "player-2", "mon"),
      win(2024, 0, 23, "player-1", "player-2", "tue"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(0);
  });

  it("does NOT award for only 4 consecutive won days", () => {
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

  it("does NOT award for 5 won days that are not consecutive", () => {
    // Mon, Tue, Thu, Fri, Sat — Wednesday breaks every possible run.
    const events: EventType[] = [
      ...baseEvents,
      win(2024, 0, 15, "player-1", "player-2", "mon"),
      win(2024, 0, 16, "player-1", "player-2", "tue"),
      win(2024, 0, 18, "player-1", "player-2", "thu"),
      win(2024, 0, 19, "player-1", "player-2", "fri"),
      win(2024, 0, 20, "player-1", "player-2", "sat"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(0);
  });

  it("awards only once per week even when more than one run completes", () => {
    // Mon–Sat won: Mon–Fri completes on Friday and Tue–Sat would complete on
    // Saturday — one award, stamped at the Friday win.
    const events: EventType[] = [
      ...baseEvents,
      win(2024, 0, 15, "player-1", "player-2", "mon"),
      win(2024, 0, 16, "player-1", "player-2", "tue"),
      win(2024, 0, 17, "player-1", "player-2", "wed"),
      win(2024, 0, 18, "player-1", "player-2", "thu"),
      win(2024, 0, 19, "player-1", "player-2", "fri"),
      win(2024, 0, 20, "player-1", "player-2", "sat"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(1);
    expect(perfectWeeks[0].data.startDay).toBe(new Date(2024, 0, 15).getTime());
    expect(perfectWeeks[0].earnedAt).toBe(new Date(2024, 0, 19, 12).getTime());
  });

  it("awards a separate perfect-week for each qualifying week", () => {
    const events: EventType[] = [
      ...baseEvents,
      // Week of Jan 15: Mon–Fri
      win(2024, 0, 15, "player-1", "player-2", "w1-mon"),
      win(2024, 0, 16, "player-1", "player-2", "w1-tue"),
      win(2024, 0, 17, "player-1", "player-2", "w1-wed"),
      win(2024, 0, 18, "player-1", "player-2", "w1-thu"),
      win(2024, 0, 19, "player-1", "player-2", "w1-fri"),
      // Week of Jan 22: Tue–Sat
      win(2024, 0, 23, "player-1", "player-2", "w2-tue"),
      win(2024, 0, 24, "player-1", "player-2", "w2-wed"),
      win(2024, 0, 25, "player-1", "player-2", "w2-thu"),
      win(2024, 0, 26, "player-1", "player-2", "w2-fri"),
      win(2024, 0, 27, "player-1", "player-2", "w2-sat"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(2);
    expect(perfectWeeks[0].data.startDay).toBe(new Date(2024, 0, 15).getTime());
    expect(perfectWeeks[1].data.startDay).toBe(new Date(2024, 0, 23).getTime());
  });

  it("only counts wins, not losses, toward a day", () => {
    const events: EventType[] = [
      ...baseEvents,
      win(2024, 0, 15, "player-1", "player-2", "mon"),
      win(2024, 0, 16, "player-1", "player-2", "tue"),
      win(2024, 0, 17, "player-1", "player-2", "wed"),
      win(2024, 0, 18, "player-1", "player-2", "thu"),
      // Friday: player-1 LOSES — does not count as a Friday win, and no
      // other run is completable from these days.
      win(2024, 0, 19, "player-2", "player-1", "fri"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(0);
  });

  it("losses on run days do not disqualify the run", () => {
    const events: EventType[] = [
      ...baseEvents,
      win(2024, 0, 15, "player-1", "player-2", "mon"),
      win(2024, 0, 16, "player-1", "player-2", "tue"),
      // A Wednesday loss alongside the Wednesday win — still a won day.
      win(2024, 0, 17, "player-2", "player-1", "wed-loss"),
      win(2024, 0, 17, "player-1", "player-2", "wed"),
      win(2024, 0, 18, "player-1", "player-2", "thu"),
      win(2024, 0, 19, "player-1", "player-2", "fri"),
    ];

    const tennisTable = new TennisTable({ events });
    tennisTable.achievements.calculateAchievements();

    const perfectWeeks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "perfect-week");
    expect(perfectWeeks).toHaveLength(1);
  });

  it("awards immediately on the completing win, without waiting for the week to end", () => {
    // "now" is Friday afternoon, right after the fifth consecutive won day.
    // Losses never disqualify a perfect week, so it is awarded on the spot.
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2024, 0, 19, 13));

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
    expect(perfectWeeks[0].earnedAt).toBe(new Date(2024, 0, 19, 12).getTime());

    jest.useRealTimers();
  });

  describe("Progression (best still-completable run this week)", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("a Monday win reads 1/5 and holds through Tuesday", () => {
      // "now" is Tuesday afternoon; only Monday has been won so far.
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 0, 16, 15));

      const events: EventType[] = [...baseEvents, win(2024, 0, 15, "player-1", "player-2", "mon")];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const progression = tennisTable.achievements.getPlayerProgression("player-1");
      expect(progression["perfect-week"].current).toBe(1);
      expect(progression["perfect-week"].target).toBe(5);
      expect(progression["perfect-week"].earned).toBe(0);
    });

    it("counts the current day once it is won (Mon+Tue on Tuesday = 2/5)", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 0, 16, 20));

      const events: EventType[] = [
        ...baseEvents,
        win(2024, 0, 15, "player-1", "player-2", "mon"),
        win(2024, 0, 16, "player-1", "player-2", "tue"),
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const progression = tennisTable.achievements.getPlayerProgression("player-1");
      expect(progression["perfect-week"].current).toBe(2);
    });

    it("falls back to the Wed–Sun run when Tuesday passed with no win", () => {
      // "now" is Wednesday; Monday and Wednesday won, Tuesday missed. The
      // Mon–Fri and Tue–Sat runs are dead, but Wed–Sun is alive at 1.
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 0, 17, 12));

      const events: EventType[] = [
        ...baseEvents,
        win(2024, 0, 15, "player-1", "player-2", "mon"),
        win(2024, 0, 17, "player-1", "player-2", "wed"),
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const progression = tennisTable.achievements.getPlayerProgression("player-1");
      expect(progression["perfect-week"].current).toBe(1);
    });

    it("drops to 0 on Thursday when Wednesday also passed with no win", () => {
      // Monday won, Tuesday and Wednesday missed — every run this week is
      // dead (Wed–Sun needs Wednesday, which has elapsed).
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 0, 18, 12));

      const events: EventType[] = [...baseEvents, win(2024, 0, 15, "player-1", "player-2", "mon")];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const progression = tennisTable.achievements.getPlayerProgression("player-1");
      expect(progression["perfect-week"].current).toBe(0);
    });

    it("weekend wins count toward the late runs (Wed–Sat won on Saturday = 4/5)", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 0, 20, 18));

      const events: EventType[] = [
        ...baseEvents,
        win(2024, 0, 17, "player-1", "player-2", "wed"),
        win(2024, 0, 18, "player-1", "player-2", "thu"),
        win(2024, 0, 19, "player-1", "player-2", "fri"),
        win(2024, 0, 20, "player-1", "player-2", "sat"),
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const progression = tennisTable.achievements.getPlayerProgression("player-1");
      expect(progression["perfect-week"].current).toBe(4);
    });

    it("resets to 0 the following week (last week's wins do not carry over)", () => {
      // "now" is the Monday after a nearly-won week — new attempt, no games yet.
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 0, 22, 8));

      const events: EventType[] = [
        ...baseEvents,
        win(2024, 0, 15, "player-1", "player-2", "mon"),
        win(2024, 0, 16, "player-1", "player-2", "tue"),
        win(2024, 0, 17, "player-1", "player-2", "wed"),
        win(2024, 0, 18, "player-1", "player-2", "thu"),
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const progression = tennisTable.achievements.getPlayerProgression("player-1");
      expect(progression["perfect-week"].current).toBe(0);
    });

    it("keeps the best run from past weeks as the best value", () => {
      // "now" is the Monday after a Mon–Thu near-miss (4 of the 5 days of
      // the Mon–Fri run). Current resets, the best keeps the attempt.
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 0, 22, 8));

      const events: EventType[] = [
        ...baseEvents,
        win(2024, 0, 15, "player-1", "player-2", "mon"),
        win(2024, 0, 16, "player-1", "player-2", "tue"),
        win(2024, 0, 17, "player-1", "player-2", "wed"),
        win(2024, 0, 18, "player-1", "player-2", "thu"),
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const progression = tennisTable.achievements.getPlayerProgression("player-1");
      expect(progression["perfect-week"].current).toBe(0);
      expect(progression["perfect-week"].best).toBe(4);
    });
  });
});
