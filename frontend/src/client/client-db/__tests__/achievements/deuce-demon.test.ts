import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Deuce Demon: win 10 career deuce sets (winner ≥ 12, loser ≥ 10 — the same
// qualifying rule Marathon Set uses). Either player of a game can win a
// qualifying set. One-time achievement, awarded on the crossing.

describe("Deuce Demon Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
  ];

  // A game where `winner` beats `loser` 2 sets to 1: two 12–10 deuce sets to
  // the winner and one 12–10 deuce set to the loser.
  const deuceGame = (id: string, time: number, winner: string, loser: string): EventType[] => [
    {
      type: EventTypeEnum.GAME_CREATED,
      stream: id,
      time,
      data: { winner, loser, playedAt: time },
    },
    {
      type: EventTypeEnum.GAME_SCORE,
      stream: id,
      time: time + 1,
      data: {
        setsWon: { gameWinner: 2, gameLoser: 1 },
        setPoints: [
          { gameWinner: 12, gameLoser: 10 },
          { gameWinner: 10, gameLoser: 12 },
          { gameWinner: 13, gameLoser: 11 },
        ],
      },
    },
  ];

  // A game with no deuce sets.
  const plainGame = (id: string, time: number, winner: string, loser: string): EventType[] => [
    {
      type: EventTypeEnum.GAME_CREATED,
      stream: id,
      time,
      data: { winner, loser, playedAt: time },
    },
    {
      type: EventTypeEnum.GAME_SCORE,
      stream: id,
      time: time + 1,
      data: {
        setsWon: { gameWinner: 2, gameLoser: 0 },
        setPoints: [
          { gameWinner: 11, gameLoser: 5 },
          { gameWinner: 11, gameLoser: 9 },
        ],
      },
    },
  ];

  it("awards after 10 career deuce sets won, stamped at the crossing game", () => {
    // Each deuceGame gives the game winner 2 deuce sets and the loser 1.
    // After 5 games Alice has 10 and Bob has 5.
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 5; i++) {
      events.push(...deuceGame(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceAwards = tt.achievements.getAchievements("alice").filter((a) => a.type === "deuce-demon");
    expect(aliceAwards).toHaveLength(1);
    // Alice reaches 10 in the 5th game (played at 140).
    expect(aliceAwards[0].earnedAt).toBe(140);
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "deuce-demon")).toHaveLength(0);
  });

  it("counts deuce sets won by the game LOSER too", () => {
    // Bob loses every game but wins 1 deuce set per game → 10 games gets him there.
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 10; i++) {
      events.push(...deuceGame(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const bobAwards = tt.achievements.getAchievements("bob").filter((a) => a.type === "deuce-demon");
    expect(bobAwards).toHaveLength(1);
    expect(bobAwards[0].earnedAt).toBe(190);
  });

  it("is awarded only once, even as the count keeps growing", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 12; i++) {
      events.push(...deuceGame(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "deuce-demon")).toHaveLength(1);
  });

  it("does NOT count ordinary sets (11–9 or below, or a 13–9 blowout)", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 10; i++) {
      events.push(...plainGame(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "deuce-demon")).toHaveLength(0);
    const progression = tt.achievements.getPlayerProgression("alice");
    expect(progression["deuce-demon"].current).toBe(0);
  });

  it("tracks progression toward the 10-set target", () => {
    // 2 deuce games → Alice has 4 deuce sets, Bob has 2.
    const events: EventType[] = [
      ...baseEvents,
      ...deuceGame("g1", 100, "alice", "bob"),
      ...deuceGame("g2", 200, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceProgress = tt.achievements.getPlayerProgression("alice");
    expect(aliceProgress["deuce-demon"].current).toBe(4);
    expect(aliceProgress["deuce-demon"].target).toBe(10);
    expect(aliceProgress["deuce-demon"].earned).toBe(0);

    const bobProgress = tt.achievements.getPlayerProgression("bob");
    expect(bobProgress["deuce-demon"].current).toBe(2);
  });

  it("caps progression at the target so the career total is not exposed", () => {
    // 8 deuce games → Alice has 16 deuce sets, well past the target of 10.
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 8; i++) {
      events.push(...deuceGame(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const progression = tt.achievements.getPlayerProgression("alice");
    expect(progression["deuce-demon"].current).toBe(10);
    expect(progression["deuce-demon"].earned).toBe(1);
  });
});
