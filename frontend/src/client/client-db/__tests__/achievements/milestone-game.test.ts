import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Milestone Game is awarded to BOTH players of every 500th league game
// (the 500th, 1,000th, 1,500th, ...). Deleted games do not count — the
// numbering follows the games that still exist.
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

  it("awards BOTH players of the 500th game — and not the games around it", () => {
    const events: EventType[] = [...baseEvents, ...games(501)];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getAchievements("alice").filter((a) => a.type === "milestone-game");
    const bob = tt.achievements.getAchievements("bob").filter((a) => a.type === "milestone-game");
    expect(alice).toHaveLength(1);
    expect(bob).toHaveLength(1);
    expect(alice[0]).toStrictEqual({
      type: "milestone-game",
      earnedBy: "alice",
      earnedAt: 1000 + 499,
      earnedByGame: "g-500",
      data: { gameId: "g-500", opponent: "bob", milestone: 500 },
    });
    expect(bob[0].data?.opponent).toBe("alice");
  });

  it("does NOT award before the first milestone", () => {
    const events: EventType[] = [...baseEvents, ...games(499)];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "milestone-game")).toHaveLength(0);
  });

  it("awards at every 500th game — one badge per milestone", () => {
    const events: EventType[] = [...baseEvents, ...games(1500)];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getAchievements("alice").filter((a) => a.type === "milestone-game");
    expect(alice.map((a) => a.data?.milestone)).toStrictEqual([500, 1000, 1500]);
  });

  it("deleted games do not count toward the milestone numbering", () => {
    // 500 games are created, but one early game is deleted — so the game
    // created 500th is only league game #499, and the 501st created game
    // becomes the real #500.
    const events: EventType[] = [
      ...baseEvents,
      ...games(500),
      { type: EventTypeEnum.GAME_DELETED, stream: "g-250", time: 5000, data: null },
      game("g-501", 6000, "carol", "alice"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const carol = tt.achievements.getAchievements("carol").filter((a) => a.type === "milestone-game");
    expect(carol).toHaveLength(1);
    expect(carol[0].data).toStrictEqual({ gameId: "g-501", opponent: "alice", milestone: 500 });

    // Alice was in every game; her only milestone badge is g-501 too — the
    // originally-500th created game never counted as #500.
    const alice = tt.achievements.getAchievements("alice").filter((a) => a.type === "milestone-game");
    expect(alice).toHaveLength(1);
    expect(alice[0].data?.gameId).toBe("g-501");
  });

  it("progression restarts at each milestone and spans the 500-game interval", () => {
    // 620 games: 120 into the 500-game stretch toward 1,000 — 380 to go.
    const events: EventType[] = [...baseEvents, ...games(620)];

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

  it("progression starts from 0 and resets to 0 at a milestone", () => {
    const before = new TennisTable({ events: [...baseEvents, ...games(499)] });
    before.achievements.calculateAchievements();
    const beforeProgress = before.achievements.getPlayerProgression("alice")["milestone-game"];
    expect(beforeProgress.current).toBe(499);
    expect(beforeProgress.target).toBe(500);

    const at = new TennisTable({ events: [...baseEvents, ...games(500)] });
    at.achievements.calculateAchievements();
    const atProgress = at.achievements.getPlayerProgression("alice")["milestone-game"];
    expect(atProgress.current).toBe(0);
    expect(atProgress.target).toBe(500);
  });
});
