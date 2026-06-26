import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// The "first-game" achievement is awarded on a player's very first game
// ever — win or lose. It is earnable exactly once per player.

describe("First Game Achievement", () => {
  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  const players = (): EventType[] => [
    { time: 1, stream: "alice", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
    { time: 2, stream: "bob", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
  ];

  it("awards first-game to both players on their first game", () => {
    const events: EventType[] = [...players(), game("g1", 100, "alice", "bob")];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceFirst = tt.achievements.getAchievements("alice").filter((a) => a.type === "first-game");
    expect(aliceFirst).toHaveLength(1);
    expect(aliceFirst[0].earnedAt).toBe(100);
    expect(aliceFirst[0].data).toEqual({ gameId: "g1", opponent: "bob" });

    const bobFirst = tt.achievements.getAchievements("bob").filter((a) => a.type === "first-game");
    expect(bobFirst).toHaveLength(1);
    expect(bobFirst[0].earnedAt).toBe(100);
    expect(bobFirst[0].data).toEqual({ gameId: "g1", opponent: "alice" });
  });

  it("awards first-game on a loss, not just a win", () => {
    // Bob's first appearance is as the loser of g1.
    const events: EventType[] = [...players(), game("g1", 100, "alice", "bob")];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "first-game")).toHaveLength(1);
  });

  it("is only awarded once even after many more games", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", 100, "alice", "bob"),
      game("g2", 200, "alice", "bob"),
      game("g3", 300, "bob", "alice"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "first-game")).toHaveLength(1);
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "first-game")).toHaveLength(1);
  });

  it("records the achievement on each player's own first game", () => {
    // Carol joins later — her first game is g2, not g1.
    const events: EventType[] = [
      ...players(),
      { time: 3, stream: "carol", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Carol" } },
      game("g1", 100, "alice", "bob"),
      game("g2", 200, "alice", "carol"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const carolFirst = tt.achievements.getAchievements("carol").filter((a) => a.type === "first-game");
    expect(carolFirst).toHaveLength(1);
    expect(carolFirst[0].earnedAt).toBe(200);
    expect(carolFirst[0].data).toEqual({ gameId: "g2", opponent: "alice" });
  });

  it("reports zero progress before any game and full progress after", () => {
    const before = new TennisTable({ events: [...players()] });
    before.achievements.calculateAchievements();
    expect(before.achievements.getPlayerProgression("alice")["first-game"]).toEqual({
      current: 0,
      target: 1,
      earned: 0,
    });

    const after = new TennisTable({ events: [...players(), game("g1", 100, "alice", "bob")] });
    after.achievements.calculateAchievements();
    expect(after.achievements.getPlayerProgression("alice")["first-game"]).toEqual({
      current: 1,
      target: 1,
      earned: 1,
    });
  });
});
