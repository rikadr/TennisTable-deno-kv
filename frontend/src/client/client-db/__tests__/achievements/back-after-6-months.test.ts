import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("TennisTable", () => {
  let tennisTable: TennisTable;
  let events: EventType[];

  beforeEach(() => {
    events = [];
  });

  describe("Back-after-6-months", () => {
    const SIX_MONTHS = 6 * 30 * 24 * 60 * 60 * 1000;
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

    it("should not earn achievement when returning after 5 months (just below threshold)", () => {
      const now = Date.now();
      const fiveMonthsAgo = now - 5 * 30 * 24 * 60 * 60 * 1000;

      // Alice plays a game 5 months ago
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: fiveMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: fiveMonthsAgo },
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
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-6-months");

      expect(backAfterAchievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["back-after-6-months"].earned).toBe(0);
      expect(progression["back-after-6-months"].target).toBe(SIX_MONTHS);
      expect(progression["back-after-6-months"].lastActiveAt).toBe(now);
    });

    it("should earn achievement when returning after 6 months plus a day", () => {
      const now = Date.now();
      const sixMonthsPlusOneDayAgo = now - (SIX_MONTHS + ONE_DAY);

      // Alice plays a game 6 months + 1 day ago
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: sixMonthsPlusOneDayAgo,
        data: { winner: "alice", loser: "bob", playedAt: sixMonthsPlusOneDayAgo },
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
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-6-months");

      expect(backAfterAchievements).toHaveLength(1);
      expect(backAfterAchievements[0]).toStrictEqual({
        type: "back-after-6-months",
        earnedBy: "alice",
        earnedAt: now, // Time of the return game
        data: {
          lastGameAt: sixMonthsPlusOneDayAgo, // Time of the last game before the break
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["back-after-6-months"].earned).toBe(1);
    });

    it("should not earn achievement if player never stopped playing", () => {
      const now = Date.now();
      const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
      const twoMonthsAgo = now - 2 * 30 * 24 * 60 * 60 * 1000;
      const fourMonthsAgo = now - 4 * 30 * 24 * 60 * 60 * 1000;
      const sevenMonthsAgo = now - 7 * 30 * 24 * 60 * 60 * 1000;
      const tenMonthsAgo = now - 10 * 30 * 24 * 60 * 60 * 1000;

      // Alice plays games regularly with no 6-month gap between consecutive games
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: tenMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: tenMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game2",
        time: sevenMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: sevenMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game3",
        time: fourMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: fourMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game4",
        time: twoMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: twoMonthsAgo },
      });

      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game5",
        time: oneMonthAgo,
        data: { winner: "alice", loser: "bob", playedAt: oneMonthAgo },
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
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-6-months");

      expect(backAfterAchievements).toHaveLength(0);
    });

    it("should earn achievement multiple times on separate returns", () => {
      const now = Date.now();
      const sevenMonthsAgo = now - 7 * 30 * 24 * 60 * 60 * 1000;
      const fourteenMonthsAgo = now - 14 * 30 * 24 * 60 * 60 * 1000;

      // Alice plays a game 14 months ago
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: fourteenMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: fourteenMonthsAgo },
      });

      // Alice returns after 7 months (first return at 7 months ago from now)
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game2",
        time: sevenMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: sevenMonthsAgo },
      });

      // Alice goes inactive again, then returns after another 7 months (today)
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game3",
        time: now,
        data: { winner: "alice", loser: "bob", playedAt: now },
      });

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-6-months");

      expect(backAfterAchievements).toHaveLength(2);
      expect(backAfterAchievements[0]).toStrictEqual({
        type: "back-after-6-months",
        earnedBy: "alice",
        earnedAt: sevenMonthsAgo, // Time of the first return
        data: {
          lastGameAt: fourteenMonthsAgo, // Time of the last game before first break
        },
      });
      expect(backAfterAchievements[1]).toStrictEqual({
        type: "back-after-6-months",
        earnedBy: "alice",
        earnedAt: now, // Time of the second return
        data: {
          lastGameAt: sevenMonthsAgo, // Time of the last game before second break
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["back-after-6-months"].earned).toBe(2);
    });

    it("should show correct progression while player is currently inactive", () => {
      const now = Date.now();
      const sevenMonthsAgo = now - 7 * 30 * 24 * 60 * 60 * 1000;

      // Alice plays a game 7 months ago and hasn't returned
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: sevenMonthsAgo,
        data: { winner: "alice", loser: "bob", playedAt: sevenMonthsAgo },
      });

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const backAfterAchievements = achievements.filter((a) => a.type === "back-after-6-months");

      // No achievement yet (player hasn't returned even though they've been inactive for 7 months)
      expect(backAfterAchievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");

      // Progression should show time since last activity (over 6 months)
      expect(progression["back-after-6-months"].current).toBeGreaterThan(SIX_MONTHS);
      expect(progression["back-after-6-months"].target).toBe(SIX_MONTHS);
      expect(progression["back-after-6-months"].lastActiveAt).toBe(sevenMonthsAgo);
      expect(progression["back-after-6-months"].earned).toBe(0);

      // Current should be approximately 7 months (allow some tolerance for test execution time)
      const sevenMonths = 7 * 30 * 24 * 60 * 60 * 1000;
      expect(progression["back-after-6-months"].current).toBeGreaterThanOrEqual(sevenMonths);
      expect(progression["back-after-6-months"].current).toBeLessThan(sevenMonths + 1000); // Within 1 second
    });
  });
});
