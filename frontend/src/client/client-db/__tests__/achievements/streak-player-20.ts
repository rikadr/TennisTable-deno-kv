import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("TennisTable", () => {
  let tennisTable: TennisTable;
  let events: EventType[];

  beforeEach(() => {
    events = [];
  });

  describe("Streak-player-20", () => {
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

    it("should not earn achievement with 19 consecutive wins against same opponent (just below threshold)", () => {
      // Alice wins 19 games against Bob
      for (let i = 1; i <= 19; i++) {
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
      const streakAchievements = achievements.filter((a) => a.type === "streak-player-20");

      expect(streakAchievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-player-20"]).toStrictEqual({
        current: 19,
        target: 20,
        earned: 0,
        perOpponent: new Map([["bob", 19]]),
      });
    });

    it("should earn achievement at exactly 20 consecutive wins against same opponent", () => {
      // Alice wins 20 games against Bob
      for (let i = 1; i <= 20; i++) {
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
      const streakAchievements = achievements.filter((a) => a.type === "streak-player-20");

      expect(streakAchievements).toHaveLength(1);
      expect(streakAchievements[0]).toStrictEqual({
        type: "streak-player-20",
        earnedBy: "alice",
        earnedAt: 1200, // Time of the 20th game
        data: {
          opponent: "bob",
          startedAt: 1010, // Time of the 1st game
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-player-20"]).toStrictEqual({
        current: 0, // No other streaks below 20
        target: 20,
        earned: 1,
        perOpponent: new Map([["bob", 20]]),
      });
    });

    it("should only earn achievement once even with 21 consecutive wins against same opponent", () => {
      // Alice wins 21 games against Bob
      for (let i = 1; i <= 21; i++) {
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
      const streakAchievements = achievements.filter((a) => a.type === "streak-player-20");

      expect(streakAchievements).toHaveLength(1);
      expect(streakAchievements[0]).toStrictEqual({
        type: "streak-player-20",
        earnedBy: "alice",
        earnedAt: 1200, // Time of the 20th game
        data: {
          opponent: "bob",
          startedAt: 1010, // Time of the 1st game
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-player-20"]).toStrictEqual({
        current: 0, // No other streaks below 20
        target: 20,
        earned: 1,
        perOpponent: new Map([["bob", 21]]),
      });
    });

    it("should track streaks independently per opponent", () => {
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

      // Alice wins 10 more games against Bob (total 20 vs Bob)
      for (let i = 21; i <= 30; i++) {
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
      const streakAchievements = achievements.filter((a) => a.type === "streak-player-20");

      expect(streakAchievements).toHaveLength(1);
      expect(streakAchievements[0]).toStrictEqual({
        type: "streak-player-20",
        earnedBy: "alice",
        earnedAt: 1300, // Time of the 30th game (20th win vs Bob)
        data: {
          opponent: "bob",
          startedAt: 1010, // Time of the 1st game vs Bob
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-player-20"]).toStrictEqual({
        current: 10, // Charlie's streak of 10 becomes the current (highest below 20)
        target: 20,
        earned: 1,
        perOpponent: new Map([
          ["bob", 20],
          ["charlie", 10],
        ]),
      });
    });

    it("should reset only the specific opponent's streak after loss to that opponent", () => {
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

      // Alice loses to Bob (resets Bob streak only)
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game21",
        time: 1210,
        data: { winner: "bob", loser: "alice", playedAt: 1210 },
      });

      // Alice wins 12 more games against Bob
      for (let i = 22; i <= 33; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1210 + (i - 21) * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1210 + (i - 21) * 10 },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const streakAchievements = achievements.filter((a) => a.type === "streak-player-20");

      expect(streakAchievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-player-20"]).toStrictEqual({
        current: 12, // Bob's new streak of 12 is highest (Charlie has 10)
        target: 20,
        earned: 0,
        perOpponent: new Map([
          ["bob", 12],
          ["charlie", 10],
        ]),
      });
    });

    it("should earn multiple achievements for different opponents", () => {
      // Alice wins 20 games against Bob
      for (let i = 1; i <= 20; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1000 + i * 10 },
        });
      }

      // Alice wins 20 games against Charlie
      for (let i = 21; i <= 40; i++) {
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
      const streakAchievements = achievements.filter((a) => a.type === "streak-player-20");

      expect(streakAchievements).toHaveLength(2);
      expect(streakAchievements[0]).toStrictEqual({
        type: "streak-player-20",
        earnedBy: "alice",
        earnedAt: 1200, // Time of the 20th game (20th win vs Bob)
        data: {
          opponent: "bob",
          startedAt: 1010, // Time of the 1st game vs Bob
        },
      });
      expect(streakAchievements[1]).toStrictEqual({
        type: "streak-player-20",
        earnedBy: "alice",
        earnedAt: 1400, // Time of the 40th game (20th win vs Charlie)
        data: {
          opponent: "charlie",
          startedAt: 1210, // Time of the 21st game (1st game vs Charlie)
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["streak-player-20"]).toStrictEqual({
        current: 0, // Both opponents at 20, no streaks below 20
        target: 20,
        earned: 2,
        perOpponent: new Map([
          ["bob", 20],
          ["charlie", 20],
        ]),
      });
    });
  });
});
