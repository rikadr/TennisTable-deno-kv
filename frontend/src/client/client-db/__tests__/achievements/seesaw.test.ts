import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";
import { leadChangesInSets, SEESAW_MIN_LEAD_CHANGES } from "../../achievements";

// Seesaw: play a set of a tracked game where the lead changes
// SEESAW_MIN_LEAD_CHANGES or more times. Both players earn it, once per game.

describe("Seesaw Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
  ];

  // A set with `changes` lead changes that the game winner wins. The players
  // take turns to score 2 points in a row, so the lead changes every 2
  // points. The first point goes to the player who makes the game winner the
  // last to go in front, so the points that finish the set add no change.
  const setWithLeadChanges = (changes: number): string => {
    const first = changes % 2 === 1 ? "L" : "W";
    const other = first === "W" ? "L" : "W";
    let sequence = first;
    for (let i = 0; i < changes; i++) sequence += (i % 2 === 0 ? other : first).repeat(2);
    const winnerPoints = [...sequence].filter((point) => point === "W").length;
    const loserPoints = sequence.length - winnerPoints;
    const target = Math.max(11, loserPoints + 2);
    return sequence + "W".repeat(target - winnerPoints);
  };

  const points = (sequence: string) => ({
    gameWinner: [...sequence].filter((point) => point === "W").length,
    gameLoser: [...sequence].filter((point) => point === "L").length,
  });

  const trackedGame = (id: string, time: number, sequences: string[]): EventType[] => [
    { type: EventTypeEnum.GAME_CREATED, stream: id, time, data: { winner: "alice", loser: "bob", playedAt: time } },
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

  const seesaws = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "seesaw");

  it("counts a change only when the other player goes in front", () => {
    const game = trackedGame("g1", 100, ["WLLWWL" + "W".repeat(10), "WWLL" + "W".repeat(9)]);
    const tt = new TennisTable({ events: [...baseEvents, ...game] });

    // W, tie, L in front, tie, W in front, tie: 2 changes. Then W stays in
    // front. The second set has no change: the ties do not count.
    expect(leadChangesInSets(tt.games[0])).toEqual([2, 0]);
  });

  it("awards both players when a set reaches the minimum", () => {
    const tt = new TennisTable({
      events: [...baseEvents, ...trackedGame("g1", 100, ["W".repeat(11), setWithLeadChanges(SEESAW_MIN_LEAD_CHANGES)])],
    });
    tt.achievements.calculateAchievements();

    const alice = seesaws(tt, "alice");
    expect(alice).toHaveLength(1);
    expect(alice[0].earnedByGame).toBe("g1");
    expect(alice[0].data).toEqual({
      gameId: "g1",
      opponent: "bob",
      setNumber: 2,
      leadChanges: SEESAW_MIN_LEAD_CHANGES,
    });
    expect(seesaws(tt, "bob")).toHaveLength(1);
    expect(seesaws(tt, "bob")[0].data.opponent).toBe("alice");
  });

  it("does NOT award a set below the minimum, and shows the best set as progress", () => {
    const tt = new TennisTable({
      events: [...baseEvents, ...trackedGame("g1", 100, [setWithLeadChanges(SEESAW_MIN_LEAD_CHANGES - 1)])],
    });
    tt.achievements.calculateAchievements();

    expect(seesaws(tt, "alice")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("bob").seesaw.current).toBe(SEESAW_MIN_LEAD_CHANGES - 1);
  });

  it("awards once per game, for the set with the most lead changes", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        ...trackedGame("g1", 100, [
          setWithLeadChanges(SEESAW_MIN_LEAD_CHANGES),
          setWithLeadChanges(SEESAW_MIN_LEAD_CHANGES + 2),
        ]),
        ...trackedGame("g2", 200, [setWithLeadChanges(SEESAW_MIN_LEAD_CHANGES)]),
      ],
    });
    tt.achievements.calculateAchievements();

    const alice = seesaws(tt, "alice");
    expect(alice.map((a) => [a.data.gameId, a.data.setNumber, a.data.leadChanges])).toEqual([
      ["g1", 2, SEESAW_MIN_LEAD_CHANGES + 2],
      ["g2", 1, SEESAW_MIN_LEAD_CHANGES],
    ]);
    expect(tt.achievements.getPlayerProgression("alice").seesaw.earned).toBe(2);
  });

  it("does NOT award a game without a point log", () => {
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

    expect(seesaws(tt, "alice")).toHaveLength(0);
  });
});
