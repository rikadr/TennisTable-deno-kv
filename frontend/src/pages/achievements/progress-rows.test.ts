import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { TennisTable } from "../../client/client-db/tennis-table";
import { playersProgressForType, topCareerCounts } from "./progress-rows";

describe("playersProgressForType", () => {
  it("puts an active player before a retired player with the same progress", () => {
    // Alice is created first and is retired. Neither player has a game.
    const events: EventType[] = [
      { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "alice" } },
      { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "bob" } },
      { type: EventTypeEnum.PLAYER_DEACTIVATED, stream: "alice", time: 3, data: null },
    ];
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const rows = playersProgressForType(tt, "first-game");
    expect(rows.map((row) => [row.player.id, row.isRetired])).toEqual([
      ["bob", false],
      ["alice", true],
    ]);
  });
});

describe("topCareerCounts", () => {
  const players = ["alice", "bob", "carol", "dave"];

  /** A game `loser` loses to the next player, with 2 sets and no point. */
  function donutGames(loser: string, games: number, offset: number): EventType[] {
    const winner = players[(players.indexOf(loser) + 1) % players.length];
    return Array.from({ length: games }, (_, index): EventType[] => {
      const playedAt = 1000 + offset + index * 10;
      const stream = `${loser}-${index}`;
      return [
        { type: EventTypeEnum.GAME_CREATED, stream, time: playedAt, data: { winner, loser, playedAt } },
        {
          type: EventTypeEnum.GAME_SCORE,
          stream,
          time: playedAt + 1,
          data: {
            setsWon: { gameWinner: 2, gameLoser: 0 },
            setPoints: [
              { gameWinner: 11, gameLoser: 0 },
              { gameWinner: 11, gameLoser: 0 },
            ],
          },
        },
      ];
    }).flat();
  }

  function rowsFor(events: EventType[]) {
    const tt = new TennisTable({
      events: [
        ...players.map(
          (name, index): EventType => ({
            type: EventTypeEnum.PLAYER_CREATED,
            stream: name,
            time: index + 1,
            data: { name },
          }),
        ),
        ...events,
      ],
    });
    tt.achievements.calculateAchievements();
    return playersProgressForType(tt, "donut-baker");
  }

  it("ranks the holders on the full count, and leaves out a player below the target", () => {
    // Alice gives 12 donut sets, Bob and Carol 6 each, Dave 4 — below the 5.
    const rows = rowsFor([
      ...donutGames("alice", 6, 0),
      ...donutGames("bob", 3, 1000),
      ...donutGames("carol", 3, 2000),
      ...donutGames("dave", 2, 3000),
    ]);

    expect(topCareerCounts(rows, 5).map((row) => [row.player.id, row.total, row.rank])).toEqual([
      ["alice", 12, 1],
      ["bob", 6, 2],
      ["carol", 6, 2],
    ]);
  });

  it("stops at the limit", () => {
    const rows = rowsFor([
      ...donutGames("alice", 6, 0),
      ...donutGames("bob", 3, 1000),
      ...donutGames("carol", 4, 2000),
    ]);

    expect(topCareerCounts(rows, 2).map((row) => row.player.id)).toEqual(["alice", "carol"]);
  });

  it("is empty for an achievement with no career count", () => {
    const tt = new TennisTable({
      events: [{ type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "alice" } }],
    });
    tt.achievements.calculateAchievements();

    expect(topCareerCounts(playersProgressForType(tt, "first-game"), 5)).toEqual([]);
  });
});
