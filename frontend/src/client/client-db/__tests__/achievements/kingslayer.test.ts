import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Default GuestClient has gameLimitForRanked = 5, so a player needs 5+ games
// to be considered for ranking.

describe("Kingslayer Achievement", () => {
  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  // 5-player double round-robin (20 games). Outcomes: A beats B/C/D/E,
  // B beats C/D/E, C beats D/E, D beats E — each pair twice. After
  // playback every player has 8 games (ranked) and standings are:
  //   A = 8W            → rank 1
  //   B = 6W 2L         → rank 2
  //   C = 4W 4L         → rank 3
  //   D = 2W 6L         → rank 4
  //   E = 0W 8L         → rank 5
  // All 5 ranked from time 113 onward (A's 8th game).
  const fivePlayerSetup = (): EventType[] => {
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
      { time: 3, stream: "c", type: EventTypeEnum.PLAYER_CREATED, data: { name: "C" } },
      { time: 4, stream: "d", type: EventTypeEnum.PLAYER_CREATED, data: { name: "D" } },
      { time: 5, stream: "e", type: EventTypeEnum.PLAYER_CREATED, data: { name: "E" } },
    ];
    const pairs: [string, string][] = [
      ["a", "b"], ["a", "c"], ["a", "d"], ["a", "e"],
      ["b", "c"], ["b", "d"], ["b", "e"],
      ["c", "d"], ["c", "e"],
      ["d", "e"],
    ];
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of pairs) {
        events.push(game(`g-${round}-${winner}-${loser}`, t++, winner, loser));
      }
    }
    return events;
  };

  it("awards kingslayer when a player beats rank #1 with ≥5 ranked players", () => {
    // After the setup, A is rank #1 with all 5 players ranked. B beats A
    // in a follow-up match — kingslayer fires for B.
    const events = [...fivePlayerSetup(), game("ks", 1000, "b", "a")];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const kingslayers = tt.achievements.getAchievements("b").filter((x) => x.type === "kingslayer");
    expect(kingslayers).toHaveLength(1);
    expect(kingslayers[0].data).toEqual({ opponent: "a", gameId: "ks" });
  });

  it("does NOT award kingslayer when the loser is not rank #1", () => {
    // B beats C (rank 3). C is not rank 1, no kingslayer.
    const events = [...fivePlayerSetup(), game("g", 1000, "b", "c")];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("b").filter((x) => x.type === "kingslayer")).toHaveLength(0);
  });

  it("does NOT award kingslayer when no one is yet ranked", () => {
    // Only 2 games — nobody has reached 5-game threshold.
    const events: EventType[] = [
      { time: 1, stream: "alice", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
      { time: 2, stream: "bob", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
      { time: 3, stream: "carol", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Carol" } },
      game("g1", 100, "bob", "carol"),
      game("g2", 200, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((x) => x.type === "kingslayer")).toHaveLength(0);
  });

  it("does NOT award when fewer than 5 players are ranked", () => {
    // 4 players in a double round-robin (12 games). After playback all 4
    // are ranked but rankedCount = 4 < 5. Alice (5th, unranked) beats A.
    // Without 5 ranked players the achievement does not fire.
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
      { time: 3, stream: "c", type: EventTypeEnum.PLAYER_CREATED, data: { name: "C" } },
      { time: 4, stream: "d", type: EventTypeEnum.PLAYER_CREATED, data: { name: "D" } },
      { time: 5, stream: "alice", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
    ];
    const pairs: [string, string][] = [
      ["a", "b"], ["a", "c"], ["a", "d"],
      ["b", "c"], ["b", "d"],
      ["c", "d"],
    ];
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of pairs) {
        events.push(game(`g-${round}-${winner}-${loser}`, t++, winner, loser));
      }
    }
    events.push(game("ks", 1000, "alice", "a"));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((x) => x.type === "kingslayer")).toHaveLength(0);
  });

  it("is only awarded once per player even if they kingslay multiple times", () => {
    // B kingslays A. A then beats C/D/E to climb back to #1. B kingslays
    // A a second time — but the second one should NOT fire.
    const events = [
      ...fivePlayerSetup(),
      game("ks-1", 1000, "b", "a"),
      game("recover-1", 1100, "a", "c"),
      game("recover-2", 1101, "a", "d"),
      game("recover-3", 1102, "a", "e"),
      game("ks-2", 2000, "b", "a"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const kingslayers = tt.achievements.getAchievements("b").filter((x) => x.type === "kingslayer");
    expect(kingslayers).toHaveLength(1);
    expect(kingslayers[0].data?.gameId).toBe("ks-1");
  });
});
