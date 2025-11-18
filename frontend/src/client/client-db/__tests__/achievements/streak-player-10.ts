import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("TennisTable", () => {
  let tennisTable: TennisTable;
  let events: EventType[];

  beforeEach(() => {
    events = [];
  });

  describe("Streak-player-10", () => {
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

    it("should not earn achievement with 9 consecutive wins against same opponent (just below threshold)", () => {
      // Alice wins 9 games against Bob
      for (let i = 1; i <= 9; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1000 + i * 10 },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const streakAchievements = achievements.filter((a) => a.type === "streak-player-10");

      expect(streakAchievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-player-10"]).toStrictEqual({
        current: 9,
        target: 10,
        earned: 0,
        perOpponent: new Map([["bob", 9]]),
      });
    });

    it("should earn achievement at exactly 10 consecutive wins against same opponent", () => {
      // Alice wins 10 games against Bob
      for (let i = 1; i <= 10; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1000 + i * 10 },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const streakAchievements = achievements.filter((a) => a.type === "streak-player-10");

      expect(streakAchievements).toHaveLength(1);
      expect(streakAchievements[0]).toStrictEqual({
        type: "streak-player-10",
        earnedBy: "alice",
        earnedAt: 1100, // Time of the 10th game
        data: {
          opponent: "bob",
          startedAt: 1010, // Time of the 1st game
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-player-10"]).toStrictEqual({
        current: 0, // No other streaks below 10
        target: 10,
        earned: 1,
        perOpponent: new Map([["bob", 10]]),
      });
    });

    it("should only earn achievement once even with 11 consecutive wins against same opponent", () => {
      // Alice wins 11 games against Bob
      for (let i = 1; i <= 11; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1000 + i * 10 },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const streakAchievements = achievements.filter((a) => a.type === "streak-player-10");

      expect(streakAchievements).toHaveLength(1);
      expect(streakAchievements[0]).toStrictEqual({
        type: "streak-player-10",
        earnedBy: "alice",
        earnedAt: 1100, // Time of the 10th game
        data: {
          opponent: "bob",
          startedAt: 1010, // Time of the 1st game
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-player-10"]).toStrictEqual({
        current: 0, // No other streaks below 10
        target: 10,
        earned: 1,
        perOpponent: new Map([["bob", 11]]),
      });
    });

    it("should track streaks independently per opponent", () => {
      // Alice wins 5 games against Bob
      for (let i = 1; i <= 5; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1000 + i * 10 },
        });
      }

      // Alice wins 5 games against Charlie
      for (let i = 6; i <= 10; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "charlie", playedAt: 1000 + i * 10 },
        });
      }

      // Alice wins 5 more games against Bob (total 10 vs Bob)
      for (let i = 11; i <= 15; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1000 + i * 10 },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const streakAchievements = achievements.filter((a) => a.type === "streak-player-10");

      expect(streakAchievements).toHaveLength(1);
      expect(streakAchievements[0]).toStrictEqual({
        type: "streak-player-10",
        earnedBy: "alice",
        earnedAt: 1150, // Time of the 15th game (10th win vs Bob)
        data: {
          opponent: "bob",
          startedAt: 1010, // Time of the 1st game vs Bob
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-player-10"]).toStrictEqual({
        current: 5, // Charlie's streak of 5 becomes the current (highest below 10)
        target: 10,
        earned: 1,
        perOpponent: new Map([
          ["bob", 10],
          ["charlie", 5],
        ]),
      });
    });

    it("should reset only the specific opponent's streak after loss to that opponent", () => {
      // Alice wins 5 games against Bob
      for (let i = 1; i <= 5; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1000 + i * 10 },
        });
      }

      // Alice wins 5 games against Charlie
      for (let i = 6; i <= 10; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "charlie", playedAt: 1000 + i * 10 },
        });
      }

      // Alice loses to Bob (resets Bob streak only)
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game11",
        time: 1110,
        data: { winner: "bob", loser: "alice", playedAt: 1110 },
      });

      // Alice wins 6 more games against Bob
      for (let i = 12; i <= 17; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1110 + (i - 11) * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1110 + (i - 11) * 10 },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const streakAchievements = achievements.filter((a) => a.type === "streak-player-10");

      expect(streakAchievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-player-10"]).toStrictEqual({
        current: 6, // Bob's new streak of 6 is highest (Charlie has 5)
        target: 10,
        earned: 0,
        perOpponent: new Map([
          ["bob", 6],
          ["charlie", 5],
        ]),
      });
    });

    it("should earn multiple achievements for different opponents", () => {
      // Alice wins 10 games against Bob
      for (let i = 1; i <= 10; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1000 + i * 10 },
        });
      }

      // Alice wins 10 games against Charlie
      for (let i = 11; i <= 20; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "charlie", playedAt: 1000 + i * 10 },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const streakAchievements = achievements.filter((a) => a.type === "streak-player-10");

      expect(streakAchievements).toHaveLength(2);
      expect(streakAchievements[0]).toStrictEqual({
        type: "streak-player-10",
        earnedBy: "alice",
        earnedAt: 1100, // Time of the 10th game (10th win vs Bob)
        data: {
          opponent: "bob",
          startedAt: 1010, // Time of the 1st game vs Bob
        },
      });
      expect(streakAchievements[1]).toStrictEqual({
        type: "streak-player-10",
        earnedBy: "alice",
        earnedAt: 1200, // Time of the 20th game (10th win vs Charlie)
        data: {
          opponent: "charlie",
          startedAt: 1110, // Time of the 11th game (1st game vs Charlie)
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-player-10"]).toStrictEqual({
        current: 0, // Both opponents at 10, no streaks below 10
        target: 10,
        earned: 2,
        perOpponent: new Map([
          ["bob", 10],
          ["charlie", 10],
        ]),
      });
    });
  });
});
