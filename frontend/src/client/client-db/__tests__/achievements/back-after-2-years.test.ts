import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("TennisTable", () => {
  let tennisTable: TennisTable;
  let events: EventType[];

  beforeEach(() => {
    events = [];
  });

  describe("Back-after-2-years", () => {
    const TWO_YEARS = 2 * 365 * 24 * 60 * 60 * 1000;
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

    it("should not earn achievement when returning after 23 months (just below threshold)", () => {
      const now = Date.now();
      const twentyThreeMonthsAgo = now - 23 * 30 * 24 * 60 * 60 * 1000;

      // Alice plays a game 23 months ago
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: twentyThreeMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: twentyThreeMonthsAgo },
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
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-2-years");

      expect(backAfterAchievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["back-after-2-years"].earned).toBe(0);
      expect(progression["back-after-2-years"].target).toBe(TWO_YEARS);
      expect(progression["back-after-2-years"].lastActiveAt).toBe(now);
    });

    it("should earn achievement when returning after 2 years plus a day", () => {
      const now = Date.now();
      const twoYearsPlusOneDayAgo = now - (TWO_YEARS + ONE_DAY);

      // Alice plays a game 2 years + 1 day ago
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: twoYearsPlusOneDayAgo,
        data: { winner: "alice", loser: "bob", playedAt: twoYearsPlusOneDayAgo },
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
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-2-years");

      expect(backAfterAchievements).toHaveLength(1);
      expect(backAfterAchievements[0]).toStrictEqual({
        type: "back-after-2-years",
        earnedBy: "alice",
        earnedAt: now, // Time of the return game
        data: {
          lastGameAt: twoYearsPlusOneDayAgo, // Time of the last game before the break
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["back-after-2-years"].earned).toBe(1);
    });

    it("should not earn achievement if player never stopped playing", () => {
      const now = Date.now();
      const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60 * 1000;
      const twelveMonthsAgo = now - 12 * 30 * 24 * 60 * 60 * 1000;
      const eighteenMonthsAgo = now - 18 * 30 * 24 * 60 * 60 * 1000;
      const twentyFourMonthsAgo = now - 24 * 30 * 24 * 60 * 60 * 1000;
      const thirtyMonthsAgo = now - 30 * 30 * 24 * 60 * 60 * 1000;

      // Alice plays games regularly with no 2-year gap between consecutive games
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: thirtyMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: thirtyMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game2",
        time: twentyFourMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: twentyFourMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game3",
        time: eighteenMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: eighteenMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game4",
        time: twelveMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: twelveMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game5",
        time: sixMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: sixMonthsAgo },
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
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-2-years");

      expect(backAfterAchievements).toHaveLength(0);
    });

    it("should earn achievement multiple times on separate returns", () => {
      const now = Date.now();
      const twentyFiveMonthsAgo = now - 25 * 30 * 24 * 60 * 60 * 1000;
      const fiftyMonthsAgo = now - 50 * 30 * 24 * 60 * 60 * 1000;

      // Alice plays a game 50 months ago
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: fiftyMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: fiftyMonthsAgo },
      });

      // Alice returns after 25 months (first return at 25 months ago from now)
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game2",
        time: twentyFiveMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: twentyFiveMonthsAgo },
      });

      // Alice goes inactive again, then returns after another 25 months (today)
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game3",
        time: now,
        data: { winner: "alice", loser: "bob", playedAt: now },
      });

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-2-years");

      expect(backAfterAchievements).toHaveLength(2);
      expect(backAfterAchievements[0]).toStrictEqual({
        type: "back-after-2-years",
        earnedBy: "alice",
        earnedAt: twentyFiveMonthsAgo, // Time of the first return
        data: {
          lastGameAt: fiftyMonthsAgo, // Time of the last game before first break
        },
      });
      expect(backAfterAchievements[1]).toStrictEqual({
        type: "back-after-2-years",
        earnedBy: "alice",
        earnedAt: now, // Time of the second return
        data: {
          lastGameAt: twentyFiveMonthsAgo, // Time of the last game before second break
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["back-after-2-years"].earned).toBe(2);
    });

    it("should show correct progression while player is currently inactive", () => {
      const now = Date.now();
      const twentyFiveMonthsAgo = now - 25 * 30 * 24 * 60 * 60 * 1000;

      // Alice plays a game 25 months ago and hasn't returned
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: twentyFiveMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: twentyFiveMonthsAgo },
      });

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-2-years");

      // No achievement yet (player hasn't returned even though they've been inactive for 25 months)
      expect(backAfterAchievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");

      // Progression should show time since last activity (over 2 years)
      expect(progression["back-after-2-years"].current).toBeGreaterThan(TWO_YEARS);
      expect(progression["back-after-2-years"].target).toBe(TWO_YEARS);
      expect(progression["back-after-2-years"].lastActiveAt).toBe(twentyFiveMonthsAgo);
      expect(progression["back-after-2-years"].earned).toBe(0);

      // Current should be approximately 25 months (allow some tolerance for test execution time)
      const twentyFiveMonths = 25 * 30 * 24 * 60 * 60 * 1000;
      expect(progression["back-after-2-years"].current).toBeGreaterThanOrEqual(twentyFiveMonths);
      expect(progression["back-after-2-years"].current).toBeLessThan(twentyFiveMonths + 1000); // Within 1 second
    });
  });
});
