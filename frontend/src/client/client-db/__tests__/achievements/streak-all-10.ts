import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("TennisTable", () => {
  let tennisTable: TennisTable;
  let events: EventType[];

  beforeEach(() => {
    events = [];
  });

  describe("Streak-all-10", () => {
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
        {
          type: EventTypeEnum.PLAYER_CREATED,
          stream: "charlie",
          time: 102,
          data: { name: "Charlie" },
        },
        {
          type: EventTypeEnum.PLAYER_CREATED,
          stream: "diana",
          time: 103,
          data: { name: "Diana" },
        },
      ];
      tennisTable = new TennisTable({ events });
    });

    it("should not earn achievement with 9 consecutive wins (just below threshold)", () => {
      const opponents = ["bob", "charlie", "diana", "bob", "charlie", "diana", "bob", "charlie", "diana"];

      for (let i = 1; i <= 9; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: opponents[i - 1], playedAt: 1000 + i * 10 },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const streakAchievements = achievements.filter((a) => a.type === "streak-all-10");

      expect(streakAchievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-all-10"]).toStrictEqual({ current: 9, target: 10, earned: 0 });
    });

    it("should earn achievement at exactly 10 consecutive wins", () => {
      const opponents = ["bob", "charlie", "diana", "bob", "charlie", "diana", "bob", "charlie", "diana", "bob"];

      for (let i = 1; i <= 10; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: opponents[i - 1], playedAt: 1000 + i * 10 },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const streakAchievements = achievements.filter((a) => a.type === "streak-all-10");

      expect(streakAchievements).toHaveLength(1);
      expect(streakAchievements[0]).toStrictEqual({
        type: "streak-all-10",
        earnedBy: "alice",
        earnedAt: 1100, // Time of the 10th game
        data: {
          startedAt: 1010, // Time of the 1st game
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-all-10"]).toStrictEqual({ current: 10, target: 10, earned: 1 });
    });

    it("should only earn achievement once even with 11 consecutive wins", () => {
      const opponents = [
        "bob",
        "charlie",
        "diana",
        "bob",
        "charlie",
        "diana",
        "bob",
        "charlie",
        "diana",
        "bob",
        "charlie",
      ];

      for (let i = 1; i <= 11; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: opponents[i - 1], playedAt: 1000 + i * 10 },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const streakAchievements = achievements.filter((a) => a.type === "streak-all-10");

      expect(streakAchievements).toHaveLength(1);
      expect(streakAchievements[0]).toStrictEqual({
        type: "streak-all-10",
        earnedBy: "alice",
        earnedAt: 1100, // Time of the 10th game (when threshold was crossed)
        data: {
          startedAt: 1010, // Time of the 1st game
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-all-10"]).toStrictEqual({ current: 11, target: 10, earned: 1 });
    });

    it("should reset progress after a loss", () => {
      const opponents = ["bob", "charlie", "diana", "bob", "charlie"]; // 5 wins

      // Alice wins 5 games
      for (let i = 1; i <= 5; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: opponents[i - 1], playedAt: 1000 + i * 10 },
        });
      }

      // Alice loses 1 game
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game6",
        time: 1060,
        data: { winner: "bob", loser: "alice", playedAt: 1060 },
      });

      const opponents2 = ["charlie", "diana", "bob", "charlie", "diana", "bob"]; // 6 wins

      // Alice wins 6 more games
      for (let i = 7; i <= 12; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1060 + (i - 6) * 10,
          data: { winner: "alice", loser: opponents2[i - 7], playedAt: 1060 + (i - 6) * 10 },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const streakAchievements = achievements.filter((a) => a.type === "streak-all-10");

      expect(streakAchievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-all-10"]).toStrictEqual({ current: 6, target: 10, earned: 0 });
    });

    it("should earn achievement multiple times with losses in between", () => {
      const opponents1 = ["bob", "charlie", "diana", "bob", "charlie", "diana", "bob", "charlie", "diana", "bob"];

      // Alice wins 10 games (first achievement)
      for (let i = 1; i <= 10; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: opponents1[i - 1], playedAt: 1000 + i * 10 },
        });
      }

      // Alice loses 1 game (reset)
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game11",
        time: 1110,
        data: { winner: "charlie", loser: "alice", playedAt: 1110 },
      });

      const opponents2 = ["diana", "bob", "charlie", "diana", "bob", "charlie", "diana", "bob", "charlie", "diana"];

      // Alice wins 10 more games (second achievement)
      for (let i = 12; i <= 21; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1110 + (i - 11) * 10,
          data: { winner: "alice", loser: opponents2[i - 12], playedAt: 1110 + (i - 11) * 10 },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const streakAchievements = achievements.filter((a) => a.type === "streak-all-10");

      expect(streakAchievements).toHaveLength(2);
      expect(streakAchievements[0]).toStrictEqual({
        type: "streak-all-10",
        earnedBy: "alice",
        earnedAt: 1100, // Time of the 10th game (first streak)
        data: {
          startedAt: 1010, // Time of the 1st game
        },
      });
      expect(streakAchievements[1]).toStrictEqual({
        type: "streak-all-10",
        earnedBy: "alice",
        earnedAt: 1210, // Time of the 21st game (second streak)
        data: {
          startedAt: 1120, // Time of the 12th game (start of second streak)
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-all-10"]).toStrictEqual({ current: 10, target: 10, earned: 2 });
    });
  });
});
