import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("TennisTable", () => {
  let tennisTable: TennisTable;
  let events: EventType[];

  const players: EventType[] = [
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

  /** A game Alice wins, with `donutSets` sets where Bob does not score. */
  function addGame(gameNumber: number, donutSets: number) {
    const playedAt = 1000 + gameNumber * 10;
    events.push({
      type: EventTypeEnum.GAME_CREATED,
      stream: `game${gameNumber}`,
      time: playedAt,
      data: { winner: "alice", loser: "bob", playedAt },
    });
    events.push({
      type: EventTypeEnum.GAME_SCORE,
      stream: `game${gameNumber}`,
      time: playedAt + 1,
      data: {
        setsWon: { gameWinner: 2, gameLoser: 0 },
        setPoints: Array.from({ length: 2 }, (_, setIndex) => ({
          gameWinner: 11,
          gameLoser: setIndex < donutSets ? 0 : 1,
        })),
      },
    });
  }

  beforeEach(() => {
    events = [...players];
  });

  describe("Donut-baker", () => {
    it("should not earn achievement with 4 donuts given (just below threshold)", () => {
      for (let i = 1; i <= 4; i++) {
        addGame(i, 1);
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("bob").filter((a) => a.type === "donut-baker");
      expect(achievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("bob");
      expect(progression["donut-baker"]).toStrictEqual({ current: 4, target: 5, earned: 0 });
    });

    it("should earn achievement exactly at 5 donuts given", () => {
      for (let i = 1; i <= 5; i++) {
        addGame(i, 1);
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("bob").filter((a) => a.type === "donut-baker");
      expect(achievements).toHaveLength(1);
      expect(achievements[0]).toStrictEqual({
        type: "donut-baker",
        earnedBy: "bob",
        earnedAt: 1050, // Time of the 5th game
        earnedByGame: "game5",
        data: undefined,
      });

      const progression = tennisTable.achievements.getPlayerProgression("bob");
      expect(progression["donut-baker"]).toStrictEqual({ current: 5, target: 5, earned: 1 });
    });

    it("should earn achievement when one game takes the count past the target", () => {
      // 4 donuts in the first 2 games, then a game with 2 more donuts: the
      // count goes from 4 to 6 in one step and still earns the achievement.
      addGame(1, 2);
      addGame(2, 2);
      addGame(3, 2);

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("bob").filter((a) => a.type === "donut-baker");
      expect(achievements).toHaveLength(1);
      expect(achievements[0]).toStrictEqual({
        type: "donut-baker",
        earnedBy: "bob",
        earnedAt: 1030, // Time of the 3rd game
        earnedByGame: "game3",
        data: undefined,
      });
    });

    it("should only earn achievement once, and cap the progress at the target", () => {
      for (let i = 1; i <= 11; i++) {
        addGame(i, 1);
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("bob").filter((a) => a.type === "donut-baker");
      expect(achievements).toHaveLength(1);
      expect(achievements[0].earnedAt).toBe(1050); // Time of the 5th game

      const progression = tennisTable.achievements.getPlayerProgression("bob");
      expect(progression["donut-baker"]).toStrictEqual({ current: 5, target: 5, earned: 1 });
    });

    it("should not award the winner of the donut sets", () => {
      for (let i = 1; i <= 5; i++) {
        addGame(i, 1);
      }

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      const achievements = tennisTable.achievements.getAchievements("alice").filter((a) => a.type === "donut-baker");
      expect(achievements).toHaveLength(0);

      const progression = tennisTable.achievements.getPlayerProgression("alice");
      expect(progression["donut-baker"]).toStrictEqual({ current: 0, target: 5, earned: 0 });
    });
  });
});
