import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Clockwork: 20 games in a row where the favourite won, from the prediction
// before each game at 50% or more confidence. A win by the underdog ends the
// run. A game with less confidence does not count and does not end the run.

describe("Clockwork Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
  ];

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    type: EventTypeEnum.GAME_CREATED,
    stream: id,
    time,
    data: { winner, loser, playedAt: time },
  });

  // Alice wins 19 of each 20 games. The prediction is below 50% confidence
  // until after the 60th game, so none of these games count.
  const history = (): EventType[] =>
    Array.from({ length: 60 }, (_, i) =>
      i % 20 === 19 ? game(`g${i + 1}`, 100 + i, "bob", "alice") : game(`g${i + 1}`, 100 + i, "alice", "bob"),
    );

  const aliceWins = (count: number, startTime: number, prefix: string): EventType[] =>
    Array.from({ length: count }, (_, i) => game(`${prefix}${i + 1}`, startTime + i, "alice", "bob"));

  const clockworkAwards = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "clockwork");

  it("awards both players at the 20th game in a row that the favourite won", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...history(), ...aliceWins(25, 1000, "c")] });
    tt.achievements.calculateAchievements();

    for (const [playerId, opponent] of [
      ["alice", "bob"],
      ["bob", "alice"],
    ]) {
      const awards = clockworkAwards(tt, playerId);
      expect(awards).toHaveLength(1);
      expect(awards[0].earnedByGame).toBe("c20");
      expect(awards[0].data).toEqual({ gameId: "c20", opponent, startedAt: 1000 });
    }
    // The run starts again after the award.
    const alice = tt.achievements.getPlayerProgression("alice").clockwork;
    expect(alice).toMatchObject({ current: 5, target: 20, best: 20 });
  });

  it("does not award 19 games in a row", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...history(), ...aliceWins(19, 1000, "c")] });
    tt.achievements.calculateAchievements();

    expect(clockworkAwards(tt, "alice")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("alice").clockwork.current).toBe(19);
  });

  it("starts the run again when the underdog wins", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        ...history(),
        ...aliceWins(15, 1000, "c"),
        game("underdog", 2000, "bob", "alice"),
        ...aliceWins(15, 3000, "d"),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(clockworkAwards(tt, "alice")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("alice").clockwork).toMatchObject({ current: 15, best: 15 });
  });
});
