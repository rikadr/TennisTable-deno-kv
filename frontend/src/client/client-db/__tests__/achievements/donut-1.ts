import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("TennisTable", () => {
  let tennisTable: TennisTable;
  let events: EventType[];

  beforeEach(() => {
    events = [];
  });

  describe("Donut", () => {
    beforeEach(() => {
      events = [
        {
          type: EventTypeEnum.PLAYER_CREATED,
          stream: "alice",
          time: 1000,
          data: { name: "Alice" },
        },
        {
          type: EventTypeEnum.PLAYER_CREATED,
          stream: "bob",
          time: 1001,
          data: { name: "Bob" },
        },
      ];
      tennisTable = new TennisTable({ events });
    });

    it("should earn once for one donut set", () => {
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: 1003,
        data: { winner: "alice", loser: "bob", playedAt: 1003 },
      });
      events.push({
        type: EventTypeEnum.GAME_SCORE,
        stream: "game1",
        time: 1004,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 0 },
          setPoints: [
            { gameWinner: 11, gameLoser: 0 },
            { gameWinner: 11, gameLoser: 1 },
          ],
        },
      });
      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const donuts = achievements.filter((a) => a.type === "donut-1");

      expect(donuts).toHaveLength(1);
      expect(donuts[0]).toStrictEqual({
        type: "donut-1",
        earnedBy: "alice",
        earnedAt: 1003,
        data: {
          gameId: "game1",
          opponent: "bob",
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["donut-1"]).toStrictEqual({ current: 1, target: 1, earned: 1 });
    });

    it("should earn multiple in same game if multiple donut sets in one game", () => {
      events.push({
        type: EventTypeEnum.GAME_CREATED,
        stream: "game1",
        time: 1003,
        data: { winner: "alice", loser: "bob", playedAt: 1003 },
      });
      events.push({
        type: EventTypeEnum.GAME_SCORE,
        stream: "game1",
        time: 1004,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 0 },
          setPoints: [
            { gameWinner: 11, gameLoser: 0 },
            { gameWinner: 11, gameLoser: 0 },
          ],
        },
      });
      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice");
      const donuts = achievements.filter((a) => a.type === "donut-1");

      expect(donuts).toHaveLength(2);
      expect(donuts[0]).toStrictEqual({
        type: "donut-1",
        earnedBy: "alice",
        earnedAt: 1003,
        data: {
          gameId: "game1",
          opponent: "bob",
        },
      });
      expect(donuts[1]).toStrictEqual({
        type: "donut-1",
        earnedBy: "alice",
        earnedAt: 1003,
        data: {
          gameId: "game1",
          opponent: "bob",
        },
      });

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["donut-1"]).toStrictEqual({ current: 2, target: 1, earned: 2 });
    });
  });
});
