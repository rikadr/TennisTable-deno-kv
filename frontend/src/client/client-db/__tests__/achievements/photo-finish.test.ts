import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// The Photo Finish achievement fires when, after a match, both players' Elos
// land within 1 point of each other AND that player is ranked. With K=32 the
// math demands a pre-match Elo gap of roughly 35 (when the lower-rated
// player wins). The sequence below engineers such a gap:
//
//   Bob beats Carol 4 times       → Bob ~1055.80, Carol ~944.20
//   Carol beats Bob (upset)       → Bob ~1034.83, Carol ~965.17
//   Alice (still at 1000) beats Bob → Alice ~1017.60, Bob ~1017.23   diff ≈ 0.37

describe("Photo Finish Achievement", () => {
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

  const photoFinishEvents = (): EventType[] => [
    ...baseEvents,
    game("bc-1", 100, "bob", "carol"),
    game("bc-2", 101, "bob", "carol"),
    game("bc-3", 102, "bob", "carol"),
    game("bc-4", 103, "bob", "carol"),
    game("cb-1", 200, "carol", "bob"),
    game("photo", 300, "alice", "bob"),
  ];

  it("awards the achievement to both players when post-match Elos are within 1", () => {
    // Lower the ranked threshold via the constructor override so Alice
    // (one game — the photo finish match itself) qualifies for the test
    // without having to manipulate the field after construction.
    const tt = new TennisTable({ events: photoFinishEvents(), gameLimitForRankedOverride: 1 });
    tt.achievements.calculateAchievements();

    const alicePhotos = tt.achievements.getAchievements("alice").filter((a) => a.type === "photo-finish");
    const bobPhotos = tt.achievements.getAchievements("bob").filter((a) => a.type === "photo-finish");

    expect(alicePhotos).toHaveLength(1);
    expect(bobPhotos).toHaveLength(1);

    expect(alicePhotos[0].data).toMatchObject({ opponent: "bob", gameId: "photo" });
    expect(bobPhotos[0].data).toMatchObject({ opponent: "alice", gameId: "photo" });
    expect(alicePhotos[0].data?.eloDiff).toBeLessThanOrEqual(1);
    expect(alicePhotos[0].data?.eloDiff).toBeGreaterThanOrEqual(0);
  });

  it("does NOT award the achievement for a regular blowout match", () => {
    // Single game between equal players — post-match diff is 32, far above 1.
    const events: EventType[] = [...baseEvents, game("g1", 100, "alice", "bob")];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "photo-finish")).toHaveLength(0);
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "photo-finish")).toHaveLength(0);
  });

  it("awards neither player if either is not ranked — it's a shared moment", () => {
    // Default ranked threshold = 5 games. After the sequence, Alice has
    // played only 1 game and is unranked, while Bob has played 6 games. The
    // Photo Finish is all-or-nothing, so neither receives the badge.
    const tt = new TennisTable({ events: photoFinishEvents() });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "photo-finish")).toHaveLength(0);
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "photo-finish")).toHaveLength(0);
  });
});
