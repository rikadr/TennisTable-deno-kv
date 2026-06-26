import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// The "ranked" achievement is awarded on the exact game that pushes a
// player up to gameLimitForRanked total games — the game that makes them
// appear on the leaderboard. Progress is the games count toward that
// threshold, capped at the target so it never exceeds 100% once earned
// (which would otherwise leak the player's total games count).

describe("Ranked Achievement", () => {
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

  it("awards ranked on the game that crosses the threshold", () => {
    // gameLimitForRankedOverride = 3 → the 3rd game makes a player ranked.
    const events: EventType[] = [
      ...players(),
      game("g1", 100, "alice", "bob"),
      game("g2", 200, "alice", "bob"),
      game("g3", 300, "bob", "alice"),
    ];

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 3 });
    tt.achievements.calculateAchievements();

    const aliceRanked = tt.achievements.getAchievements("alice").filter((a) => a.type === "ranked");
    expect(aliceRanked).toHaveLength(1);
    // Earned on the 3rd game (the one that crossed the threshold).
    expect(aliceRanked[0].earnedAt).toBe(300);
    expect(aliceRanked[0].data).toEqual({ gameId: "g3", opponent: "bob" });

    const bobRanked = tt.achievements.getAchievements("bob").filter((a) => a.type === "ranked");
    expect(bobRanked).toHaveLength(1);
    expect(bobRanked[0].earnedAt).toBe(300);
  });

  it("does NOT award before the threshold is reached", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", 100, "alice", "bob"),
      game("g2", 200, "alice", "bob"),
    ];

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 3 });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "ranked")).toHaveLength(0);
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "ranked")).toHaveLength(0);
  });

  it("is only awarded once even after many more games", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", 100, "alice", "bob"),
      game("g2", 200, "alice", "bob"),
      game("g3", 300, "alice", "bob"),
      game("g4", 400, "alice", "bob"),
      game("g5", 500, "alice", "bob"),
    ];

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 3 });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "ranked")).toHaveLength(1);
  });

  it("reports progress toward the threshold before becoming ranked", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", 100, "alice", "bob"),
      game("g2", 200, "alice", "bob"),
    ];

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 5 });
    tt.achievements.calculateAchievements();

    const prog = tt.achievements.getPlayerProgression("alice")["ranked"];
    expect(prog).toEqual({ current: 2, target: 5, earned: 0 });
  });

  it("caps progress at the target once ranked, never exposing total games", () => {
    // Alice plays 8 games against a threshold of 3. Progress must read
    // 3/3 (100%), not 8/3 — otherwise the total games count would leak.
    const events: EventType[] = [...players()];
    let t = 100;
    for (let i = 0; i < 8; i++) {
      events.push(game(`g${i}`, t++, i % 2 === 0 ? "alice" : "bob", i % 2 === 0 ? "bob" : "alice"));
    }

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 3 });
    tt.achievements.calculateAchievements();

    const prog = tt.achievements.getPlayerProgression("alice")["ranked"];
    expect(prog.current).toBe(3);
    expect(prog.target).toBe(3);
    expect(prog.earned).toBe(1);
  });
});
