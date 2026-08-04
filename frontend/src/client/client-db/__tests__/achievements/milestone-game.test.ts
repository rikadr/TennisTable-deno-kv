import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Milestone Game is awarded to BOTH players of the league's 100th, 500th,
// 1,000th and every following thousandth game. Deleted games do not count —
// the numbering follows the games that still exist.
describe("Milestone Game Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
  ];

  const game = (id: string, playedAt: number, winner: string, loser: string): EventType => ({
    type: EventTypeEnum.GAME_CREATED,
    stream: id,
    time: playedAt,
    data: { winner, loser, playedAt },
  });

  // `count` alice-vs-bob games at increasing timestamps, ids g-1..g-count.
  const games = (count: number): EventType[] =>
    Array.from({ length: count }, (_, i) => game(`g-${i + 1}`, 1000 + i, "alice", "bob"));

  it("awards BOTH players of the 100th game — and not the games around it", () => {
    const events: EventType[] = [...baseEvents, ...games(101)];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getAchievements("alice").filter((a) => a.type === "milestone-game");
    const bob = tt.achievements.getAchievements("bob").filter((a) => a.type === "milestone-game");
    expect(alice).toHaveLength(1);
    expect(bob).toHaveLength(1);
    expect(alice[0]).toStrictEqual({
      type: "milestone-game",
      earnedBy: "alice",
      earnedAt: 1000 + 99,
      data: { gameId: "g-100", opponent: "bob", milestone: 100 },
    });
    expect(bob[0].data?.opponent).toBe("alice");
  });

  it("does NOT award before the first milestone", () => {
    const events: EventType[] = [...baseEvents, ...games(99)];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "milestone-game")).toHaveLength(0);
  });

  it("awards at 100, 500 and 1,000 — one badge per milestone", () => {
    const events: EventType[] = [...baseEvents, ...games(1000)];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getAchievements("alice").filter((a) => a.type === "milestone-game");
    expect(alice.map((a) => a.data?.milestone)).toStrictEqual([100, 500, 1000]);
  });

  it("deleted games do not count toward the milestone numbering", () => {
    // 100 games are created, but one early game is deleted — so the game
    // created 100th is only league game #99, and the 101st created game
    // becomes the real #100.
    const events: EventType[] = [
      ...baseEvents,
      ...games(100),
      { type: EventTypeEnum.GAME_DELETED, stream: "g-50", time: 5000, data: null },
      game("g-101", 6000, "carol", "alice"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const carol = tt.achievements.getAchievements("carol").filter((a) => a.type === "milestone-game");
    expect(carol).toHaveLength(1);
    expect(carol[0].data).toStrictEqual({ gameId: "g-101", opponent: "alice", milestone: 100 });

    // Alice was in every game; her only milestone badge is g-101 too — the
    // originally-100th created game never counted as #100.
    const alice = tt.achievements.getAchievements("alice").filter((a) => a.type === "milestone-game");
    expect(alice).toHaveLength(1);
    expect(alice[0].data?.gameId).toBe("g-101");
  });

  it("progression counts the league's games toward the next milestone", () => {
    const events: EventType[] = [...baseEvents, ...games(120)];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getPlayerProgression("alice")["milestone-game"];
    expect(alice.current).toBe(120);
    expect(alice.target).toBe(500);
    expect(alice.earned).toBe(1);

    // League-wide chase: a player who was in none of the games sees the
    // same progress, just nothing earned.
    const carol = tt.achievements.getPlayerProgression("carol")["milestone-game"];
    expect(carol.current).toBe(120);
    expect(carol.target).toBe(500);
    expect(carol.earned).toBe(0);
  });
});
