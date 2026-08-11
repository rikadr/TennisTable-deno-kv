import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("TennisTable", () => {
  let tennisTable: TennisTable;
  let events: EventType[];

  beforeEach(() => {
    events = [];
  });

  describe("Donut-5", () => {
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

    it("should not earn achievement with 4 donuts (just below threshold)", () => {
      // Create 4 games, each with 1 donut set
      for (let i = 1; i <= 4; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1000 + i * 10 },
        });
        events.push({
          type: EventTypeEnum.GAME_SCORE,
          stream: `game${i}`,
          time: 1000 + i * 10 + 1,
          data: {
            setsWon: { gameWinner: 2, gameLoser: 0 },
            setPoints: [
              { gameWinner: 11, gameLoser: 0 },
              { gameWinner: 11, gameLoser: 1 },
            ],
          },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const donut5Achievements = achievements.filter((a) => a.type === "donut-5");

      expect(donut5Achievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["donut-5"]).toStrictEqual({ current: 4, target: 5, earned: 0 });
    });

    it("should earn achievement exactly at 5 donuts", () => {
      // Create 5 games, each with 1 donut set
      for (let i = 1; i <= 5; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1000 + i * 10 },
        });
        events.push({
          type: EventTypeEnum.GAME_SCORE,
          stream: `game${i}`,
          time: 1000 + i * 10 + 1,
          data: {
            setsWon: { gameWinner: 2, gameLoser: 0 },
            setPoints: [
              { gameWinner: 11, gameLoser: 0 },
              { gameWinner: 11, gameLoser: 1 },
            ],
          },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const donut5Achievements = achievements.filter((a) => a.type === "donut-5");

      expect(donut5Achievements).toHaveLength(1);
      expect(donut5Achievements[0]).toStrictEqual({
        type: "donut-5",
        earnedBy: "alice",
        earnedAt: 1050, // Time of the 5th game
        data: undefined,
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["donut-5"]).toStrictEqual({ current: 5, target: 5, earned: 1 });
    });

    it("should only earn achievement once even with 11 donuts", () => {
      // Create 11 games, each with 1 donut set
      for (let i = 1; i <= 11; i++) {
        events.push({
          type: EventTypeEnum.GAME_CREATED,
          stream: `game${i}`,
          time: 1000 + i * 10,
          data: { winner: "alice", loser: "bob", playedAt: 1000 + i * 10 },
        });
        events.push({
          type: EventTypeEnum.GAME_SCORE,
          stream: `game${i}`,
          time: 1000 + i * 10 + 1,
          data: {
            setsWon: { gameWinner: 2, gameLoser: 0 },
            setPoints: [
              { gameWinner: 11, gameLoser: 0 },
              { gameWinner: 11, gameLoser: 1 },
            ],
          },
        });
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const donut5Achievements = achievements.filter((a) => a.type === "donut-5");

      expect(donut5Achievements).toHaveLength(1);
      expect(donut5Achievements[0]).toStrictEqual({
        type: "donut-5",
        earnedBy: "alice",
        earnedAt: 1050, // Time of the 5th game (when threshold was crossed)
        data: undefined,
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["donut-5"]).toStrictEqual({ current: 11, target: 5, earned: 1 });
    });
  });
});
