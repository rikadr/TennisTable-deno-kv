import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { WinnerSide } from "../../../../common/table-sides";

describe("Hall of Fame data volume", () => {
  const players: EventType[] = [
    { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
    { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
  ];

  const game = (id: string, time: number): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner: "a", loser: "b" },
  });

  const score = (
    id: string,
    time: number,
    data: {
      setPoints?: { gameWinner: number; gameLoser: number }[];
      gameWinnerSides?: (WinnerSide | null)[];
      pointSequences?: string[];
    },
  ): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_SCORE,
    data: { setsWon: { gameWinner: 2, gameLoser: 0 }, ...data },
  });

  const dataVolume = (events: EventType[], playerId: string) =>
    new TennisTable({ events }).hallOfFame.getScoreForAnyPlayer(playerId)?.score.dataVolume;

  it("gives no points for a game without a score", () => {
    const d = dataVolume([...players, game("g1", 100)], "a");
    expect(d?.score).toBe(0);
    expect(d?.gamesWithBadSide).toBe(0);
  });

  it("gives 1 point for a game that records the sides of the table", () => {
    const events = [...players, game("g1", 100), score("g1", 101, { gameWinnerSides: ["B", "G"] })];

    const d = dataVolume(events, "a");
    expect(d?.gamesWithBadSide).toBe(1);
    expect(d?.gamesWithSets).toBe(1);
    expect(d?.gamesWithPoints).toBe(0);
    expect(d?.liveTrackedGames).toBe(0);
    expect(d?.score).toBe(2);
  });

  it("counts a game that records the sides of some sets only", () => {
    const events = [...players, game("g1", 100), score("g1", 101, { gameWinnerSides: ["B", null] })];

    expect(dataVolume(events, "a")?.gamesWithBadSide).toBe(1);
  });

  it("counts a game where the 2 sides are equally good", () => {
    const events = [...players, game("g1", 100), score("g1", 101, { gameWinnerSides: ["N", "N"] })];

    expect(dataVolume(events, "a")?.gamesWithBadSide).toBe(1);
  });

  it("gives no point for a game that does not record the sides", () => {
    const events = [
      ...players,
      game("g1", 100),
      score("g1", 101, {
        setPoints: [
          { gameWinner: 11, gameLoser: 5 },
          { gameWinner: 11, gameLoser: 7 },
        ],
      }),
    ];

    const d = dataVolume(events, "a");
    expect(d?.gamesWithBadSide).toBe(0);
    expect(d?.score).toBe(2);
  });

  it("gives the point to both players of the game", () => {
    const events = [...players, game("g1", 100), score("g1", 101, { gameWinnerSides: ["B", "G"] })];

    expect(dataVolume(events, "a")?.gamesWithBadSide).toBe(1);
    expect(dataVolume(events, "b")?.gamesWithBadSide).toBe(1);
  });

  it("adds the sides to the other data of the same game", () => {
    const events = [
      ...players,
      game("g1", 100),
      score("g1", 101, {
        setPoints: [
          { gameWinner: 11, gameLoser: 5 },
          { gameWinner: 11, gameLoser: 7 },
        ],
        gameWinnerSides: ["B", "G"],
        pointSequences: ["WWWWWWWWWWWLLLLL", "WWWWWWWWWWWLLLLLLL"],
      }),
    ];

    const d = dataVolume(events, "a");
    expect(d?.gamesWithSets).toBe(1);
    expect(d?.gamesWithPoints).toBe(1);
    expect(d?.liveTrackedGames).toBe(1);
    expect(d?.gamesWithBadSide).toBe(1);
    expect(d?.score).toBe(4);
  });

  it("counts each game of a player", () => {
    const events = [
      ...players,
      game("g1", 100),
      score("g1", 101, { gameWinnerSides: ["B", "G"] }),
      game("g2", 200),
      score("g2", 201, { gameWinnerSides: ["G", "B"] }),
      game("g3", 300),
      score("g3", 301, {}),
    ];

    const d = dataVolume(events, "a");
    expect(d?.gamesWithBadSide).toBe(2);
    expect(d?.gamesWithSets).toBe(3);
    expect(d?.score).toBe(5);
  });
});
