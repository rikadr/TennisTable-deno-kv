import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("First to Finish Achievement", () => {
  const players: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "dave", time: 4, data: { name: "Dave" } },
  ];

  const PAST_START = Date.now() - 30 * 24 * 60 * 60 * 1000;

  /** A tournament with group play: the 4 players play in 1 group of 6 matches. */
  const tournament: EventType[] = [
    {
      type: EventTypeEnum.TOURNAMENT_CREATED,
      stream: "t1",
      time: 1000,
      data: { name: "Spring Cup", startDate: PAST_START, groupPlay: true },
    },
    {
      type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
      stream: "t1",
      time: 1001,
      data: { playerOrder: ["alice", "bob", "carol", "dave"] },
    },
  ];

  function game(stream: string, time: number, winner: string, loser: string): EventType {
    return {
      type: EventTypeEnum.GAME_CREATED,
      stream,
      time,
      data: { winner, loser, playedAt: time },
    };
  }

  function firstToFinish(events: EventType[]) {
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();
    return ["alice", "bob", "carol", "dave"].flatMap((player) =>
      tt.achievements.getAchievements(player).filter((a) => a.type === "first-to-finish"),
    );
  }

  it("awards the first player to complete all their group matches", () => {
    const awards = firstToFinish([
      ...players,
      ...tournament,
      game("g1", PAST_START + 100, "alice", "bob"),
      game("g2", PAST_START + 200, "alice", "carol"),
      game("g3", PAST_START + 300, "dave", "alice"), // Alice finishes, Dave does not
      game("g4", PAST_START + 400, "bob", "carol"),
    ]);

    expect(awards).toStrictEqual([
      {
        type: "first-to-finish",
        earnedBy: "alice",
        earnedAt: PAST_START + 300,
        earnedByGame: "g3",
        data: { tournamentId: "t1" },
      },
    ]);
  });

  it("awards both players when one match completes the group matches of both", () => {
    const awards = firstToFinish([
      ...players,
      ...tournament,
      game("g1", PAST_START + 100, "alice", "carol"),
      game("g2", PAST_START + 200, "alice", "dave"),
      game("g3", PAST_START + 300, "bob", "carol"),
      game("g4", PAST_START + 400, "bob", "dave"),
      game("g5", PAST_START + 500, "bob", "alice"), // The last match for Alice and for Bob
    ]);

    expect(awards.map((a) => a.earnedBy).sort()).toEqual(["alice", "bob"]);
    expect(awards.every((a) => a.earnedAt === PAST_START + 500 && a.earnedByGame === "g5")).toBe(true);
  });

  it("does not award before a player completes all their group matches", () => {
    const awards = firstToFinish([
      ...players,
      ...tournament,
      game("g1", PAST_START + 100, "alice", "bob"),
      game("g2", PAST_START + 200, "carol", "dave"),
    ]);

    expect(awards).toHaveLength(0);
  });

  it("counts a skipped match the player won as a completed match", () => {
    const awards = firstToFinish([
      ...players,
      ...tournament,
      game("g1", PAST_START + 100, "alice", "bob"),
      game("g2", PAST_START + 200, "alice", "carol"),
      {
        type: EventTypeEnum.TOURNAMENT_SKIP_GAME,
        stream: "t1",
        time: PAST_START + 300,
        data: { skipId: "skip1", winner: "alice", loser: "dave" },
      },
    ]);

    expect(awards).toStrictEqual([
      {
        type: "first-to-finish",
        earnedBy: "alice",
        earnedAt: PAST_START + 300,
        data: { tournamentId: "t1" },
      },
    ]);
  });

  it("does not award a player whose last match is a skip they lost", () => {
    const awards = firstToFinish([
      ...players,
      ...tournament,
      game("g1", PAST_START + 100, "alice", "dave"),
      game("g2", PAST_START + 200, "bob", "dave"),
      {
        type: EventTypeEnum.TOURNAMENT_SKIP_GAME,
        stream: "t1",
        time: PAST_START + 300,
        data: { skipId: "skip1", winner: "carol", loser: "dave" }, // Dave has a result in all matches first
      },
      game("g3", PAST_START + 400, "bob", "carol"),
      game("g4", PAST_START + 500, "bob", "alice"), // Bob is the first to finish with a played match
    ]);

    expect(awards).toStrictEqual([
      {
        type: "first-to-finish",
        earnedBy: "bob",
        earnedAt: PAST_START + 500,
        earnedByGame: "g4",
        data: { tournamentId: "t1" },
      },
    ]);
  });

  it("awards only the first player when all players finish", () => {
    const awards = firstToFinish([
      ...players,
      ...tournament,
      game("g1", PAST_START + 100, "alice", "bob"),
      game("g2", PAST_START + 200, "alice", "carol"),
      game("g3", PAST_START + 300, "alice", "dave"),
      game("g4", PAST_START + 400, "bob", "carol"),
      game("g5", PAST_START + 500, "bob", "dave"),
      game("g6", PAST_START + 600, "carol", "dave"),
    ]);

    expect(awards.map((a) => a.earnedBy)).toEqual(["alice"]);
  });
});
