import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// On the Record: take part in 5 games tracked point by point. A game counts
// when its score carries pointSequences — the log only a tracked game has.
// Both players of a tracked game get the credit, win or lose. One-time
// achievement, awarded on the crossing.

describe("On the Record Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "chris", time: 3, data: { name: "Chris" } },
  ];

  // A 2-0 game with a point log: 11–4 and 11–2, one char per point.
  const trackedGame = (id: string, time: number, winner: string, loser: string): EventType[] => [
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
          { gameWinner: 11, gameLoser: 4 },
          { gameWinner: 11, gameLoser: 2 },
        ],
        pointSequences: ["WWWLWLWWLWLWWWW", "WWLWWWWLWWWWW"],
      },
    },
  ];

  // The same game without the point log — scored by hand, not tracked.
  const untrackedGame = (id: string, time: number, winner: string, loser: string): EventType[] => [
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
          { gameWinner: 11, gameLoser: 4 },
          { gameWinner: 11, gameLoser: 2 },
        ],
      },
    },
  ];

  // A game with no score event at all.
  const scorelessGame = (id: string, time: number, winner: string, loser: string): EventType[] => [
    {
      type: EventTypeEnum.GAME_CREATED,
      stream: id,
      time,
      data: { winner, loser, playedAt: time },
    },
  ];

  it("awards after 5 tracked games, stamped at the crossing game", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 5; i++) {
      events.push(...trackedGame(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceAwards = tt.achievements.getAchievements("alice").filter((a) => a.type === "on-the-record");
    expect(aliceAwards).toHaveLength(1);
    // The 5th tracked game is played at 140.
    expect(aliceAwards[0].earnedAt).toBe(140);
  });

  it("awards both players of the tracked games, the loser included", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 5; i++) {
      events.push(...trackedGame(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    // Bob lost all 5 and still earns it at the same game.
    const bobAwards = tt.achievements.getAchievements("bob").filter((a) => a.type === "on-the-record");
    expect(bobAwards).toHaveLength(1);
    expect(bobAwards[0].earnedAt).toBe(140);
  });

  it("does NOT award before the 5th tracked game", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 4; i++) {
      events.push(...trackedGame(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "on-the-record")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("alice")["on-the-record"].current).toBe(4);
  });

  it("does NOT count games without a point log", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 10; i++) {
      events.push(...untrackedGame(`g${i}`, 100 + i * 10, "alice", "bob"));
    }
    // A game with no score event at all is not tracked either.
    events.push(...scorelessGame("g10", 300, "alice", "bob"));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "on-the-record")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("alice")["on-the-record"].current).toBe(0);
  });

  it("counts only the tracked games when both kinds are mixed", () => {
    const events: EventType[] = [...baseEvents];
    // 4 tracked games and 6 untracked ones — not enough to award.
    for (let i = 0; i < 4; i++) {
      events.push(...trackedGame(`t${i}`, 100 + i * 10, "alice", "bob"));
    }
    for (let i = 0; i < 6; i++) {
      events.push(...untrackedGame(`u${i}`, 200 + i * 10, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "on-the-record")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("alice")["on-the-record"].current).toBe(4);

    // The 5th tracked game, played after the untracked ones, awards it.
    events.push(...trackedGame("t4", 300, "alice", "bob"));
    const after = new TennisTable({ events });
    after.achievements.calculateAchievements();

    const awards = after.achievements.getAchievements("alice").filter((a) => a.type === "on-the-record");
    expect(awards).toHaveLength(1);
    expect(awards[0].earnedAt).toBe(300);
  });

  it("counts tracked games against different opponents", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...trackedGame("g1", 100, "alice", "bob"),
      ...trackedGame("g2", 110, "chris", "alice"),
      ...trackedGame("g3", 120, "alice", "chris"),
      ...trackedGame("g4", 130, "bob", "alice"),
      ...trackedGame("g5", 140, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceAwards = tt.achievements.getAchievements("alice").filter((a) => a.type === "on-the-record");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0].earnedAt).toBe(140);

    // Bob played 3 of them and Chris 2, so neither is there yet.
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "on-the-record")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("bob")["on-the-record"].current).toBe(3);
    expect(tt.achievements.getPlayerProgression("chris")["on-the-record"].current).toBe(2);
  });

  it("is awarded only once, even as the count keeps growing", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 9; i++) {
      events.push(...trackedGame(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "on-the-record")).toHaveLength(1);
  });

  it("caps progression at the target so the career total is not exposed", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 9; i++) {
      events.push(...trackedGame(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const progression = tt.achievements.getPlayerProgression("alice");
    expect(progression["on-the-record"].current).toBe(5);
    expect(progression["on-the-record"].target).toBe(5);
    expect(progression["on-the-record"].earned).toBe(1);
  });
});
