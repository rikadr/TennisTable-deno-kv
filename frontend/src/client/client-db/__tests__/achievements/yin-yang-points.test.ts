import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";
import { longestAlternatingPointRun, YIN_YANG_POINTS_RECORD_FLOOR } from "../../achievements";

// Yin Yang Points: play the longest run of alternating points in league
// history, in a tracked game. The run continues across sets. Both players
// earn it. A run of YIN_YANG_POINTS_RECORD_FLOOR establishes the first record;
// after that only a strictly longer run takes it.

describe("Yin Yang Points Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "chris", time: 3, data: { name: "Chris" } },
  ];

  // `run` alternating points that start with a point to the game loser and end
  // with a point to the game winner. Starts with "L" so that a set before it
  // that ends with a "W" point continues the run.
  const alternating = (run: number) =>
    Array.from({ length: run }, (_, i) => ((run - i) % 2 === 1 ? "W" : "L")).join("");

  const points = (sequence: string) => ({
    gameWinner: [...sequence].filter((point) => point === "W").length,
    gameLoser: [...sequence].filter((point) => point === "L").length,
  });

  const trackedGame = (id: string, time: number, winner: string, loser: string, sequences: string[]): EventType[] => [
    { type: EventTypeEnum.GAME_CREATED, stream: id, time, data: { winner, loser, playedAt: time } },
    {
      type: EventTypeEnum.GAME_SCORE,
      stream: id,
      time: time + 1,
      data: {
        setsWon: { gameWinner: sequences.length, gameLoser: 0 },
        setPoints: sequences.map(points),
        pointSequences: sequences,
      },
    },
  ];

  // A set the game winner wins with a run of `run` alternating points at
  // its start and then the winner's points in a row.
  const setWithRun = (run: number) => {
    const sequence = alternating(run);
    return sequence + "W".repeat(Math.max(11, points(sequence).gameLoser + 2) - points(sequence).gameWinner);
  };

  const awards = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "yin-yang-points");

  it("counts a run across the end of a set", () => {
    // Set 1 ends with W, L, W, L, W: the last of its 9 W points, then LWLW.
    // Set 2 starts with L, W, L, W. The run is 5 points in set 1 and 4 in
    // set 2: 9 points from set 1 to set 2.
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        ...trackedGame("g1", 100, "alice", "bob", ["W".repeat(9) + "LWLW", "LWL" + "W".repeat(10)]),
      ],
    });

    expect(longestAlternatingPointRun(tt.games[0])).toEqual({ points: 9, fromSet: 1, toSet: 2 });
  });

  it("awards both players when a run reaches the floor, and sets the first record", () => {
    const tt = new TennisTable({
      events: [...baseEvents, ...trackedGame("g1", 100, "alice", "bob", [setWithRun(YIN_YANG_POINTS_RECORD_FLOOR)])],
    });
    tt.achievements.calculateAchievements();

    const alice = awards(tt, "alice");
    expect(alice).toHaveLength(1);
    expect(alice[0].earnedByGame).toBe("g1");
    expect(alice[0].data).toEqual({
      gameId: "g1",
      opponent: "bob",
      points: YIN_YANG_POINTS_RECORD_FLOOR,
      fromSet: 1,
      toSet: 1,
      previousRecord: undefined,
    });
    expect(awards(tt, "bob")[0].data.opponent).toBe("alice");
    expect(tt.achievements.yinYangPointsRecord).toEqual({
      points: YIN_YANG_POINTS_RECORD_FLOOR,
      holders: ["alice", "bob"],
    });
  });

  it("does NOT award a run below the floor while no record exists", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        ...trackedGame("g1", 100, "alice", "bob", [setWithRun(YIN_YANG_POINTS_RECORD_FLOOR - 1)]),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(awards(tt, "alice")).toHaveLength(0);
    expect(tt.achievements.yinYangPointsRecord.points).toBeUndefined();
    expect(tt.achievements.getPlayerProgression("bob")["yin-yang-points"].current).toBe(
      YIN_YANG_POINTS_RECORD_FLOOR - 1,
    );
  });

  it("awards only a strictly longer run once a record exists", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        ...trackedGame("g1", 100, "alice", "bob", [setWithRun(YIN_YANG_POINTS_RECORD_FLOOR + 2)]),
        // Equal to the record: no award.
        ...trackedGame("g2", 200, "chris", "bob", [setWithRun(YIN_YANG_POINTS_RECORD_FLOOR + 2)]),
        // 1 longer: takes the record.
        ...trackedGame("g3", 300, "chris", "alice", [setWithRun(YIN_YANG_POINTS_RECORD_FLOOR + 3)]),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(awards(tt, "chris").map((a) => [a.data.gameId, a.data.previousRecord])).toEqual([
      ["g3", YIN_YANG_POINTS_RECORD_FLOOR + 2],
    ]);
    expect(awards(tt, "alice")).toHaveLength(2);
    expect(awards(tt, "bob")).toHaveLength(1);
    expect(tt.achievements.yinYangPointsRecord).toEqual({
      points: YIN_YANG_POINTS_RECORD_FLOOR + 3,
      holders: ["chris", "alice"],
    });
    expect(tt.achievements.getPlayerProgression("bob")["yin-yang-points"].target).toBe(
      YIN_YANG_POINTS_RECORD_FLOOR + 4,
    );
  });

  it("does NOT count a game without a point log", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        {
          type: EventTypeEnum.GAME_CREATED,
          stream: "g1",
          time: 100,
          data: { winner: "alice", loser: "bob", playedAt: 100 },
        },
        {
          type: EventTypeEnum.GAME_SCORE,
          stream: "g1",
          time: 101,
          data: { setsWon: { gameWinner: 1, gameLoser: 0 }, setPoints: [{ gameWinner: 15, gameLoser: 13 }] },
        },
      ],
    });
    tt.achievements.calculateAchievements();

    expect(longestAlternatingPointRun(tt.games[0])).toBeUndefined();
    expect(awards(tt, "alice")).toHaveLength(0);
  });
});
