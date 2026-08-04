import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Shootout is the league record for the most combined points in a single
// game, counting only the 3 highest-scoring sets so one-set games and
// best-of-5 finals compete on equal terms. A 60-point game establishes the
// first record; after that only a strictly higher score takes it. Both
// players of the record game are awarded — the points were scored together.
//
// Only games where every set has a valid score count: first to 11 (loser at
// 9 or below) or a deuce set won by exactly 2. House-rule scores like 15–12
// are silently ignored so inflated totals can't take the record.
describe("Shootout Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
  ];

  const scoredGame = (
    id: string,
    time: number,
    winner: string,
    loser: string,
    setPoints: { gameWinner: number; gameLoser: number }[],
  ): EventType[] => {
    const setsWon = {
      gameWinner: setPoints.filter((set) => set.gameWinner > set.gameLoser).length,
      gameLoser: setPoints.filter((set) => set.gameLoser > set.gameWinner).length,
    };
    return [
      { type: EventTypeEnum.GAME_CREATED, stream: id, time, data: { winner, loser, playedAt: time } },
      { type: EventTypeEnum.GAME_SCORE, stream: id, time: time + 1, data: { setsWon, setPoints } },
    ];
  };

  it("awards BOTH players with undefined previousRecord when first establishing the record", () => {
    // 22 + 24 + 20 = 66 points ≥ the 60-point floor.
    const events: EventType[] = [
      ...baseEvents,
      ...scoredGame("g1", 100, "alice", "bob", [
        { gameWinner: 12, gameLoser: 10 },
        { gameWinner: 13, gameLoser: 11 },
        { gameWinner: 11, gameLoser: 9 },
      ]),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getAchievements("alice").filter((a) => a.type === "shootout");
    const bob = tt.achievements.getAchievements("bob").filter((a) => a.type === "shootout");
    expect(alice).toHaveLength(1);
    expect(bob).toHaveLength(1);
    expect(alice[0].data).toStrictEqual({
      gameId: "g1",
      opponent: "bob",
      points: 66,
      setsCounted: 3,
      sets: [
        { playerPoints: 12, opponentPoints: 10 },
        { playerPoints: 13, opponentPoints: 11 },
        { playerPoints: 11, opponentPoints: 9 },
      ],
      previousRecord: undefined,
    });
    expect(bob[0].data?.opponent).toBe("alice");
    // The loser's badge shows the same sets from their own perspective.
    expect(bob[0].data?.sets).toStrictEqual([
      { playerPoints: 10, opponentPoints: 12 },
      { playerPoints: 11, opponentPoints: 13 },
      { playerPoints: 9, opponentPoints: 11 },
    ]);
    expect(tt.achievements.shootoutRecord).toStrictEqual({ points: 66, holders: ["alice", "bob"] });
  });

  it("does NOT award below the 60-point floor", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...scoredGame("g1", 100, "alice", "bob", [
        { gameWinner: 11, gameLoser: 5 },
        { gameWinner: 11, gameLoser: 7 },
      ]),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "shootout")).toHaveLength(0);
    expect(tt.achievements.shootoutRecord.points).toBeUndefined();
  });

  it("counts only the 3 highest-scoring sets of a best-of-5 game", () => {
    // Set sums: 22, 20, 24, 11, 11 — top 3 give 66, not the 88 total.
    const events: EventType[] = [
      ...baseEvents,
      ...scoredGame("g1", 100, "alice", "bob", [
        { gameWinner: 12, gameLoser: 10 },
        { gameWinner: 9, gameLoser: 11 },
        { gameWinner: 13, gameLoser: 11 },
        { gameWinner: 11, gameLoser: 0 },
        { gameWinner: 11, gameLoser: 0 },
      ]),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getAchievements("alice").filter((a) => a.type === "shootout");
    expect(alice).toHaveLength(1);
    expect(alice[0].data?.points).toBe(66);
    expect(alice[0].data?.setsCounted).toBe(3);
    // Only the counted sets are stored, kept in game order.
    expect(alice[0].data?.sets).toStrictEqual([
      { playerPoints: 12, opponentPoints: 10 },
      { playerPoints: 9, opponentPoints: 11 },
      { playerPoints: 13, opponentPoints: 11 },
    ]);
  });

  it("only a strictly higher score takes the record, with previousRecord recorded", () => {
    const events: EventType[] = [
      ...baseEvents,
      // Establishes the record at 66.
      ...scoredGame("g1", 100, "alice", "bob", [
        { gameWinner: 12, gameLoser: 10 },
        { gameWinner: 13, gameLoser: 11 },
        { gameWinner: 11, gameLoser: 9 },
      ]),
      // Equal score — does not take the record.
      ...scoredGame("g2", 200, "alice", "carol", [
        { gameWinner: 12, gameLoser: 10 },
        { gameWinner: 13, gameLoser: 11 },
        { gameWinner: 11, gameLoser: 9 },
      ]),
      // 26 + 24 + 20 = 70 — takes the record.
      ...scoredGame("g3", 300, "carol", "bob", [
        { gameWinner: 14, gameLoser: 12 },
        { gameWinner: 13, gameLoser: 11 },
        { gameWinner: 11, gameLoser: 9 },
      ]),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    // Alice: only the g1 record (g2 tied, g3 not her game).
    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "shootout")).toHaveLength(1);
    // Carol: the g3 record only.
    const carol = tt.achievements.getAchievements("carol").filter((a) => a.type === "shootout");
    expect(carol).toHaveLength(1);
    expect(carol[0].data).toMatchObject({ gameId: "g3", points: 70, previousRecord: 66 });
    // Bob was in both record games.
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "shootout")).toHaveLength(2);
    expect(tt.achievements.shootoutRecord).toStrictEqual({ points: 70, holders: ["carol", "bob"] });
  });

  it("silently ignores games containing an invalid set score", () => {
    const events: EventType[] = [
      ...baseEvents,
      // 27 + 24 + 22 = 73 points, but 15–12 is not a valid set score
      // (above 11 the set must be won by exactly 2).
      ...scoredGame("g1", 100, "alice", "bob", [
        { gameWinner: 15, gameLoser: 12 },
        { gameWinner: 13, gameLoser: 11 },
        { gameWinner: 12, gameLoser: 10 },
      ]),
      // 11–10 is impossible too — at 10–10 the set continues to +2.
      ...scoredGame("g2", 200, "alice", "carol", [
        { gameWinner: 11, gameLoser: 10 },
        { gameWinner: 11, gameLoser: 0 },
        { gameWinner: 11, gameLoser: 0 },
      ]),
      // A legit game afterwards still establishes the FIRST record —
      // the invalid games never became a record to beat.
      ...scoredGame("g3", 300, "carol", "bob", [
        { gameWinner: 12, gameLoser: 10 },
        { gameWinner: 13, gameLoser: 11 },
        { gameWinner: 11, gameLoser: 9 },
      ]),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "shootout")).toHaveLength(0);
    const carol = tt.achievements.getAchievements("carol").filter((a) => a.type === "shootout");
    expect(carol).toHaveLength(1);
    expect(carol[0].data).toMatchObject({ gameId: "g3", points: 66, previousRecord: undefined });
    expect(tt.achievements.shootoutRecord).toStrictEqual({ points: 66, holders: ["carol", "bob"] });

    // Invalid games do not feed the personal-best progression either.
    expect(tt.achievements.getPlayerProgression("alice")["shootout"].current).toBe(0);
  });

  it("tracks personal best and the record target in progression", () => {
    const events: EventType[] = [
      ...baseEvents,
      // Alice/Bob set the record at 66.
      ...scoredGame("g1", 100, "alice", "bob", [
        { gameWinner: 12, gameLoser: 10 },
        { gameWinner: 13, gameLoser: 11 },
        { gameWinner: 11, gameLoser: 9 },
      ]),
      // Carol's best game is 18 + 18 + 16 = 52 — under the record.
      ...scoredGame("g2", 200, "carol", "bob", [
        { gameWinner: 11, gameLoser: 7 },
        { gameWinner: 11, gameLoser: 7 },
        { gameWinner: 11, gameLoser: 5 },
      ]),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const carol = tt.achievements.getPlayerProgression("carol")["shootout"];
    expect(carol.current).toBe(52);
    expect(carol.target).toBe(67); // one beyond the record
    expect(carol.recordHolders).toStrictEqual(["alice", "bob"]);
    expect(carol.earned).toBe(0);

    const alice = tt.achievements.getPlayerProgression("alice")["shootout"];
    expect(alice.current).toBe(66);
    expect(alice.earned).toBe(1);
  });

  it("progression has no target while nobody holds the record", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...scoredGame("g1", 100, "alice", "bob", [
        { gameWinner: 11, gameLoser: 5 },
        { gameWinner: 11, gameLoser: 7 },
      ]),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getPlayerProgression("alice")["shootout"];
    expect(alice.current).toBe(34);
    expect(alice.target).toBeUndefined();
    expect(alice.recordHolders).toStrictEqual([]);
  });
});
