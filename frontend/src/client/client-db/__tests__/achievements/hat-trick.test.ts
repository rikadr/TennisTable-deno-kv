import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

describe("Hat-trick Achievement Tests", () => {
  let baseEvents: EventType[];

  beforeEach(() => {
    // Create base events with players
    baseEvents = [
      {
        time: 1000,
        stream: "player-1",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Alice" },
      },
      {
        time: 2000,
        stream: "player-2",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Bob" },
      },
      {
        time: 3000,
        stream: "player-3",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Charlie" },
      },
    ];
  });

  describe("Basic Hat-trick Achievement", () => {
    it("should award hat-trick for 3 wins within 90 minutes", () => {
      const baseTime = Date.now();
      const events: EventType[] = [
        ...baseEvents,
        // Win 1
        {
          time: baseTime,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime,
            winner: "player-1",
            loser: "player-2",
          },
        },
        // Win 2 - 30 minutes later
        {
          time: baseTime + 30 * 60 * 1000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime + 30 * 60 * 1000,
            winner: "player-1",
            loser: "player-3",
          },
        },
        // Win 3 - 60 minutes from start (30 minutes after win 2)
        {
          time: baseTime + 60 * 60 * 1000,
          stream: "game-3",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime + 60 * 60 * 1000,
            winner: "player-1",
            loser: "player-2",
          },
        },
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("player-1");
      const hatTricks = achievements.filter((a) => a.type === "hat-trick");

      expect(hatTricks).toHaveLength(1);
      expect(hatTricks[0].earnedBy).toBe("player-1");
      expect(hatTricks[0].data.firstWinAt).toBe(baseTime);
      expect(hatTricks[0].data.thirdWinAt).toBe(baseTime + 60 * 60 * 1000);
    });

    it("should NOT award hat-trick if wins are spread over more than 90 minutes", () => {
      const baseTime = Date.now();
      const events: EventType[] = [
        ...baseEvents,
        // Win 1
        {
          time: baseTime,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime,
            winner: "player-1",
            loser: "player-2",
          },
        },
        // Win 2 - 50 minutes later
        {
          time: baseTime + 50 * 60 * 1000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime + 50 * 60 * 1000,
            winner: "player-1",
            loser: "player-3",
          },
        },
        // Win 3 - 100 minutes from start (more than 90 minutes)
        {
          time: baseTime + 100 * 60 * 1000,
          stream: "game-3",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime + 100 * 60 * 1000,
            winner: "player-1",
            loser: "player-2",
          },
        },
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("player-1");
      const hatTricks = achievements.filter((a) => a.type === "hat-trick");

      expect(hatTricks).toHaveLength(0);
    });

    it("should NOT award hat-trick for only 2 wins", () => {
      const baseTime = Date.now();
      const events: EventType[] = [
        ...baseEvents,
        {
          time: baseTime,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime,
            winner: "player-1",
            loser: "player-2",
          },
        },
        {
          time: baseTime + 30 * 60 * 1000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime + 30 * 60 * 1000,
            winner: "player-1",
            loser: "player-3",
          },
        },
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("player-1");
      const hatTricks = achievements.filter((a) => a.type === "hat-trick");

      expect(hatTricks).toHaveLength(0);
    });
  });

  describe("Hat-trick Reset and Multiple Achievements", () => {
    it("should reset tracking after earning hat-trick and allow earning another", () => {
      const baseTime = Date.now();
      const events: EventType[] = [
        ...baseEvents,
        // First hat-trick (3 wins)
        {
          time: baseTime,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime,
            winner: "player-1",
            loser: "player-2",
          },
        },
        {
          time: baseTime + 20 * 60 * 1000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime + 20 * 60 * 1000,
            winner: "player-1",
            loser: "player-3",
          },
        },
        {
          time: baseTime + 40 * 60 * 1000,
          stream: "game-3",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime + 40 * 60 * 1000,
            winner: "player-1",
            loser: "player-2",
          },
        },
        // Second hat-trick (3 more wins within 90 minutes from game-3)
        {
          time: baseTime + 50 * 60 * 1000,
          stream: "game-4",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime + 50 * 60 * 1000,
            winner: "player-1",
            loser: "player-3",
          },
        },
        {
          time: baseTime + 60 * 60 * 1000,
          stream: "game-5",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime + 60 * 60 * 1000,
            winner: "player-1",
            loser: "player-2",
          },
        },
        {
          time: baseTime + 70 * 60 * 1000,
          stream: "game-6",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: baseTime + 70 * 60 * 1000,
            winner: "player-1",
            loser: "player-3",
          },
        },
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("player-1");
      const hatTricks = achievements.filter((a) => a.type === "hat-trick");

      // Should have earned 2 hat-tricks
      expect(hatTricks).toHaveLength(2);
      
      // First hat-trick
      expect(hatTricks[0].data.firstWinAt).toBe(baseTime);
      expect(hatTricks[0].data.thirdWinAt).toBe(baseTime + 40 * 60 * 1000);
      
      // Second hat-trick
      expect(hatTricks[1].data.firstWinAt).toBe(baseTime + 50 * 60 * 1000);
      expect(hatTricks[1].data.thirdWinAt).toBe(baseTime + 70 * 60 * 1000);
    });

    it("should handle 6 consecutive wins as 2 separate hat-tricks", () => {
      const baseTime = Date.now();
      const events: EventType[] = [
        ...baseEvents,
        // 6 wins, each 15 minutes apart
        {
          time: baseTime,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime, winner: "player-1", loser: "player-2" },
        },
        {
          time: baseTime + 15 * 60 * 1000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 15 * 60 * 1000, winner: "player-1", loser: "player-3" },
        },
        {
          time: baseTime + 30 * 60 * 1000,
          stream: "game-3",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 30 * 60 * 1000, winner: "player-1", loser: "player-2" },
        },
        {
          time: baseTime + 45 * 60 * 1000,
          stream: "game-4",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 45 * 60 * 1000, winner: "player-1", loser: "player-3" },
        },
        {
          time: baseTime + 60 * 60 * 1000,
          stream: "game-5",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 60 * 60 * 1000, winner: "player-1", loser: "player-2" },
        },
        {
          time: baseTime + 75 * 60 * 1000,
          stream: "game-6",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 75 * 60 * 1000, winner: "player-1", loser: "player-3" },
        },
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("player-1");
      const hatTricks = achievements.filter((a) => a.type === "hat-trick");

      expect(hatTricks).toHaveLength(2);
    });
  });

  describe("Hat-trick with Losses", () => {
    it("should NOT reset tracking when player loses", () => {
      const baseTime = Date.now();
      const events: EventType[] = [
        ...baseEvents,
        // Win 1
        {
          time: baseTime,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime, winner: "player-1", loser: "player-2" },
        },
        // Win 2
        {
          time: baseTime + 20 * 60 * 1000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 20 * 60 * 1000, winner: "player-1", loser: "player-3" },
        },
        // Loss (should not affect hat-trick tracking)
        {
          time: baseTime + 30 * 60 * 1000,
          stream: "game-3",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 30 * 60 * 1000, winner: "player-2", loser: "player-1" },
        },
        // Win 3 - still within 90 minutes of first win
        {
          time: baseTime + 40 * 60 * 1000,
          stream: "game-4",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 40 * 60 * 1000, winner: "player-1", loser: "player-2" },
        },
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("player-1");
      const hatTricks = achievements.filter((a) => a.type === "hat-trick");

      // Should still earn hat-trick despite the loss
      expect(hatTricks).toHaveLength(1);
    });
  });

  describe("Hat-trick Edge Cases", () => {
    it("should handle exactly 90 minutes between first and third win", () => {
      const baseTime = Date.now();
      const events: EventType[] = [
        ...baseEvents,
        {
          time: baseTime,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime, winner: "player-1", loser: "player-2" },
        },
        {
          time: baseTime + 45 * 60 * 1000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 45 * 60 * 1000, winner: "player-1", loser: "player-3" },
        },
        {
          time: baseTime + 90 * 60 * 1000,
          stream: "game-3",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 90 * 60 * 1000, winner: "player-1", loser: "player-2" },
        },
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("player-1");
      const hatTricks = achievements.filter((a) => a.type === "hat-trick");

      // Should earn at exactly 90 minutes
      expect(hatTricks).toHaveLength(1);
    });

    it("should NOT award if third win is 1ms over 90 minutes", () => {
      const baseTime = Date.now();
      const events: EventType[] = [
        ...baseEvents,
        {
          time: baseTime,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime, winner: "player-1", loser: "player-2" },
        },
        {
          time: baseTime + 45 * 60 * 1000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 45 * 60 * 1000, winner: "player-1", loser: "player-3" },
        },
        {
          time: baseTime + 90 * 60 * 1000 + 1,
          stream: "game-3",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 90 * 60 * 1000 + 1, winner: "player-1", loser: "player-2" },
        },
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("player-1");
      const hatTricks = achievements.filter((a) => a.type === "hat-trick");

      expect(hatTricks).toHaveLength(0);
    });

    it("should handle multiple players earning hat-tricks independently", () => {
      const baseTime = Date.now();
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "player-4",
          type: EventTypeEnum.PLAYER_CREATED,
          data: { name: "David" },
        },
        // Player 1 hat-trick
        {
          time: baseTime,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime, winner: "player-1", loser: "player-4" },
        },
        {
          time: baseTime + 20 * 60 * 1000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 20 * 60 * 1000, winner: "player-1", loser: "player-4" },
        },
        {
          time: baseTime + 40 * 60 * 1000,
          stream: "game-3",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 40 * 60 * 1000, winner: "player-1", loser: "player-4" },
        },
        // Player 2 hat-trick
        {
          time: baseTime + 50 * 60 * 1000,
          stream: "game-4",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 50 * 60 * 1000, winner: "player-2", loser: "player-3" },
        },
        {
          time: baseTime + 60 * 60 * 1000,
          stream: "game-5",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 60 * 60 * 1000, winner: "player-2", loser: "player-3" },
        },
        {
          time: baseTime + 70 * 60 * 1000,
          stream: "game-6",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 70 * 60 * 1000, winner: "player-2", loser: "player-3" },
        },
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const player1HatTricks = tennisTable.achievements.getAchievements("player-1").filter((a) => a.type === "hat-trick");
      const player2HatTricks = tennisTable.achievements.getAchievements("player-2").filter((a) => a.type === "hat-trick");

      expect(player1HatTricks).toHaveLength(1);
      expect(player2HatTricks).toHaveLength(1);
    });
  });

  describe("Hat-trick Progression", () => {
    it("should track progression towards hat-trick", () => {
      const baseTime = Date.now();
      const events: EventType[] = [
        ...baseEvents,
        {
          time: baseTime,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime, winner: "player-1", loser: "player-2" },
        },
        {
          time: baseTime + 20 * 60 * 1000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 20 * 60 * 1000, winner: "player-1", loser: "player-3" },
        },
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const progression = tennisTable.achievements.getPlayerProgression("player-1");

      expect(progression["hat-trick"].current).toBe(2);
      expect(progression["hat-trick"].target).toBe(3);
      expect(progression["hat-trick"].earned).toBe(0);
    });

    it("should show earned count after completing hat-trick", () => {
      const baseTime = Date.now();
      const events: EventType[] = [
        ...baseEvents,
        {
          time: baseTime,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime, winner: "player-1", loser: "player-2" },
        },
        {
          time: baseTime + 20 * 60 * 1000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 20 * 60 * 1000, winner: "player-1", loser: "player-3" },
        },
        {
          time: baseTime + 40 * 60 * 1000,
          stream: "game-3",
          type: EventTypeEnum.GAME_CREATED,
          data: { playedAt: baseTime + 40 * 60 * 1000, winner: "player-1", loser: "player-2" },
        },
      ];

      const tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const progression = tennisTable.achievements.getPlayerProgression("player-1");

      expect(progression["hat-trick"].earned).toBe(1);
    });
  });
});
