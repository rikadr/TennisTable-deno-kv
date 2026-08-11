import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("TennisTable", () => {
  let tennisTable: TennisTable;
  let events: EventType[];

  beforeEach(() => {
    events = [];
  });

  describe("Back-after-1-year", () => {
    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
    const ONE_DAY = 24 * 60 * 60 * 1000;

    beforeEach(() => {
      events = [
        {
          type: EventTypeEnum.PLAYER_CREATED,
          stream: "alice",
          time: 100,
          data: { name: "Alice" },
        },
        {
          type: EventTypeEnum.PLAYER_CREATED,
          stream: "bob",
          time: 101,
          data: { name: "Bob" },
        },
      ];
      tennisTable = new TennisTable({ events });
    });

    it("should not earn achievement when returning after 11 months (just below threshold)", () => {
      const now = Date.now();
      const elevenMonthsAgo = now - 11 * 30 * 24 * 60 * 60 * 1000;

      // Alice plays a game 11 months ago
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: elevenMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: elevenMonthsAgo },
      });

      // Alice returns and plays today
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game2",
        time: now,
        data: { winner: "alice", loser: "bob", playedAt: now },
      });

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-1-year");

      expect(backAfterAchievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["back-after-1-year"].earned).toBe(0);
      expect(progression["back-after-1-year"].target).toBe(ONE_YEAR);
      expect(progression["back-after-1-year"].lastActiveAt).toBe(now);
    });

    it("should earn achievement when returning after 1 year plus a day", () => {
      const now = Date.now();
      const oneYearPlusOneDayAgo = now - (ONE_YEAR + ONE_DAY);

      // Alice plays a game 1 year + 1 day ago
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: oneYearPlusOneDayAgo,
        data: { winner: "alice", loser: "bob", playedAt: oneYearPlusOneDayAgo },
      });

      // Alice returns and plays today
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game2",
        time: now,
        data: { winner: "alice", loser: "bob", playedAt: now },
      });

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-1-year");

      expect(backAfterAchievements).toHaveLength(1);
      expect(backAfterAchievements[0]).toStrictEqual({
        type: "back-after-1-year",
        earnedBy: "alice",
        earnedAt: now, // Time of the return game
        data: {
          lastGameAt: oneYearPlusOneDayAgo, // Time of the last game before the break
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["back-after-1-year"].earned).toBe(1);
    });

    it("should not earn achievement if player never stopped playing", () => {
      const now = Date.now();
      const twoMonthsAgo = now - 2 * 30 * 24 * 60 * 60 * 1000;
      const fiveMonthsAgo = now - 5 * 30 * 24 * 60 * 60 * 1000;
      const eightMonthsAgo = now - 8 * 30 * 24 * 60 * 60 * 1000;
      const elevenMonthsAgo = now - 11 * 30 * 24 * 60 * 60 * 1000;
      const fourteenMonthsAgo = now - 14 * 30 * 24 * 60 * 60 * 1000;

      // Alice plays games regularly with no 1-year gap between consecutive games
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: fourteenMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: fourteenMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game2",
        time: elevenMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: elevenMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game3",
        time: eightMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: eightMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game4",
        time: fiveMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: fiveMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game5",
        time: twoMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: twoMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game6",
        time: now,
        data: { winner: "alice", loser: "bob", playedAt: now },
      });

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-1-year");

      expect(backAfterAchievements).toHaveLength(0);
    });

    it("should earn achievement multiple times on separate returns", () => {
      const now = Date.now();
      const fourteenMonthsAgo = now - 14 * 30 * 24 * 60 * 60 * 1000;
      const twentyEightMonthsAgo = now - 28 * 30 * 24 * 60 * 60 * 1000;

      // Alice plays a game 28 months ago
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: twentyEightMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: twentyEightMonthsAgo },
      });

      // Alice returns after 14 months (first return at 14 months ago from now)
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game2",
        time: fourteenMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: fourteenMonthsAgo },
      });

      // Alice goes inactive again, then returns after another 14 months (today)
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game3",
        time: now,
        data: { winner: "alice", loser: "bob", playedAt: now },
      });

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-1-year");

      expect(backAfterAchievements).toHaveLength(2);
      expect(backAfterAchievements[0]).toStrictEqual({
        type: "back-after-1-year",
        earnedBy: "alice",
        earnedAt: fourteenMonthsAgo, // Time of the first return
        data: {
          lastGameAt: twentyEightMonthsAgo, // Time of the last game before first break
        },
      });
      expect(backAfterAchievements[1]).toStrictEqual({
        type: "back-after-1-year",
        earnedBy: "alice",
        earnedAt: now, // Time of the second return
        data: {
          lastGameAt: fourteenMonthsAgo, // Time of the last game before second break
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["back-after-1-year"].earned).toBe(2);
    });

    it("should show correct progression while player is currently inactive", () => {
      const now = Date.now();
      const fourteenMonthsAgo = now - 14 * 30 * 24 * 60 * 60 * 1000;

      // Alice plays a game 14 months ago and hasn't returned
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: fourteenMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: fourteenMonthsAgo },
      });

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-1-year");

      // No achievement yet (player hasn't returned even though they've been inactive for 14 months)
      expect(backAfterAchievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");

      // Progression should show time since last activity (over 1 year)
      expect(progression["back-after-1-year"].current).toBeGreaterThan(ONE_YEAR);
      expect(progression["back-after-1-year"].target).toBe(ONE_YEAR);
      expect(progression["back-after-1-year"].lastActiveAt).toBe(fourteenMonthsAgo);
      expect(progression["back-after-1-year"].earned).toBe(0);

      // Current should be approximately 14 months (allow some tolerance for test execution time)
      const fourteenMonths = 14 * 30 * 24 * 60 * 60 * 1000;
      expect(progression["back-after-1-year"].current).toBeGreaterThanOrEqual(fourteenMonths);
      expect(progression["back-after-1-year"].current).toBeLessThan(fourteenMonths + 1000); // Within 1 second
    });
  });
});
