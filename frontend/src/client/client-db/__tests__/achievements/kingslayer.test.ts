import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Default GuestClient has gameLimitForRanked = 5, so a player needs 5+ games
// to be considered for ranking.

describe("Kingslayer Achievement", () => {
  let baseEvents: EventType[];

  beforeEach(() => {
    baseEvents = [
      { time: 1, stream: "alice", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
      { time: 2, stream: "bob", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
      { time: 3, stream: "carol", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Carol" } },
    ];
  });

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  it("awards kingslayer to a player who beats the current rank-1 player", () => {
    // Bob beats Carol 5 times → both ranked, Bob is rank #1.
    const setup: EventType[] = [];
    for (let i = 0; i < 5; i++) {
      setup.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }
    // Alice beats Bob — Bob is currently rank #1.
    const kingslayerGame = game("g-final", 1000, "alice", "bob");

    const tt = new TennisTable({ events: [...baseEvents, ...setup, kingslayerGame] });
    tt.achievements.calculateAchievements();

    const aliceAchievements = tt.achievements.getAchievements("alice");
    const kingslayers = aliceAchievements.filter((a) => a.type === "kingslayer");

    expect(kingslayers).toHaveLength(1);
    expect(kingslayers[0].earnedBy).toBe("alice");
    expect(kingslayers[0].earnedAt).toBe(1000);
    expect(kingslayers[0].data).toEqual({ opponent: "bob", gameId: "g-final" });
  });

  it("does NOT award kingslayer when the loser is not rank #1", () => {
    // Bob beats Carol 5 times → Bob rank #1, Carol rank #2.
    const setup: EventType[] = [];
    for (let i = 0; i < 5; i++) {
      setup.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }
    // Alice beats Carol (rank #2, not #1).
    const finalGame = game("g-final", 1000, "alice", "carol");

    const tt = new TennisTable({ events: [...baseEvents, ...setup, finalGame] });
    tt.achievements.calculateAchievements();

    const aliceAchievements = tt.achievements.getAchievements("alice");
    expect(aliceAchievements.filter((a) => a.type === "kingslayer")).toHaveLength(0);
  });

  it("does NOT award kingslayer when no one is yet ranked", () => {
    // Only 2 games — nobody has reached 5-game threshold.
    const events: EventType[] = [
      ...baseEvents,
      game("g1", 100, "bob", "carol"),
      game("g2", 200, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "kingslayer")).toHaveLength(0);
  });

  it("does NOT award when only 1 player is ranked", () => {
    // Bob beats five different opponents once each, so he reaches the
    // 5-game threshold while nobody else does. Bob is technically rank #1
    // but he is the only ranked player. Alice beating him should not be
    // a kingslay because there's no one else on the leaderboard.
    const events: EventType[] = [
      ...baseEvents,
      { time: 4, stream: "dave", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Dave" } },
      { time: 5, stream: "eve", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Eve" } },
      { time: 6, stream: "frank", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Frank" } },
      { time: 7, stream: "grace", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Grace" } },
      game("g1", 100, "bob", "carol"),
      game("g2", 101, "bob", "dave"),
      game("g3", 102, "bob", "eve"),
      game("g4", 103, "bob", "frank"),
      game("g5", 104, "bob", "grace"),
      game("g-final", 1000, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "kingslayer")).toHaveLength(0);
  });

  it("is only awarded once per player even if they kingslay multiple times", () => {
    // Bob beats Carol 5 times → Bob rank #1.
    const setup: EventType[] = [];
    for (let i = 0; i < 5; i++) {
      setup.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }
    // Alice beats Bob; Bob restores his #1 by beating Carol; Alice beats Bob
    // again. Both wins fit the Kingslayer rule, but only the first is awarded.
    const moreGames: EventType[] = [
      game("ks-1", 1000, "alice", "bob"),
      game("recover-1", 1100, "bob", "carol"),
      game("recover-2", 1200, "bob", "carol"),
      game("recover-3", 1300, "bob", "carol"),
      game("ks-2", 2000, "alice", "bob"),
    ];

    const tt = new TennisTable({ events: [...baseEvents, ...setup, ...moreGames] });
    tt.achievements.calculateAchievements();

    const kingslayers = tt.achievements.getAchievements("alice").filter((a) => a.type === "kingslayer");
    expect(kingslayers).toHaveLength(1);
    expect(kingslayers[0].data?.gameId).toBe("ks-1");
  });
});
