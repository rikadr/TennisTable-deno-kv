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

  /** A game Alice wins in `sets` sets, with `donutSets` sets where Bob does not score. */
  function addGame(gameNumber: number, donutSets: number, sets = 2) {
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
        setsWon: { gameWinner: sets, gameLoser: 0 },
        setPoints: Array.from({ length: sets }, (_, setIndex) => ({
          gameWinner: 11,
          gameLoser: setIndex < donutSets ? 0 : 1,
        })),
      },
    });
  }

  function doubleDonuts(playerId: string) {
    return tennisTable.achievements.getAchievements(playerId).filter((a) => a.type === "double-donut");
  }

  beforeEach(() => {
    events = [...players];
  });

  describe("Double Donut", () => {
    it("should not earn achievement with 1 donut set in a game", () => {
      addGame(1, 1);

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      expect(doubleDonuts("alice")).toHaveLength(0);
      expect(tennisTable.achievements.getPlayerProgression("alice")["double-donut"]).toStrictEqual({ earned: 0 });
    });

    it("should not earn achievement with 2 donut sets spread over 2 games", () => {
      addGame(1, 1);
      addGame(2, 1);

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      expect(doubleDonuts("alice")).toHaveLength(0);
    });

    it("should earn achievement with 2 donut sets in a game", () => {
      addGame(1, 2);

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      expect(doubleDonuts("alice")).toStrictEqual([
        {
          type: "double-donut",
          earnedBy: "alice",
          earnedAt: 1010,
          data: { gameId: "game1", opponent: "bob" },
          earnedByGame: "game1",
        },
      ]);
      expect(tennisTable.achievements.getPlayerProgression("alice")["double-donut"]).toStrictEqual({ earned: 1 });
    });

    it("should earn achievement 1 time for a game with 3 donut sets", () => {
      addGame(1, 3, 3);

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      expect(doubleDonuts("alice")).toHaveLength(1);
    });

    it("should earn achievement again for each qualifying game", () => {
      addGame(1, 2);
      addGame(2, 1);
      addGame(3, 2);

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      expect(doubleDonuts("alice").map((a) => a.earnedByGame)).toEqual(["game1", "game3"]);
      expect(tennisTable.achievements.getPlayerProgression("alice")["double-donut"]).toStrictEqual({ earned: 2 });
    });

    it("should not award the loser of the game", () => {
      addGame(1, 2);

      tennisTable = new TennisTable({ events });
      tennisTable.achievements.calculateAchievements();

      expect(doubleDonuts("bob")).toHaveLength(0);
    });
  });
});
