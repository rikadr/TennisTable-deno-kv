import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("Marathon Set Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
  ];

  it("awards the set winner with undefined previousRecord when first establishing the league record", () => {
    const events: EventType[] = [
      ...baseEvents,
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "g1",
        time: 100,
        data: { winner: "alice", loser: "bob", playedAt: 100 },
      },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g1",
        time: 101,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 0 },
          setPoints: [
            { gameWinner: 12, gameLoser: 10 },
            { gameWinner: 11, gameLoser: 4 },
          ],
        },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceAwards = tt.achievements.getAchievements("alice").filter((a) => a.type === "marathon-set");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0]).toStrictEqual({
      type: "marathon-set",
      earnedBy: "alice",
      earnedAt: 100,
      data: {
        gameId: "g1",
        opponent: "bob",
        setWinnerScore: 12,
        setLoserScore: 10,
        previousRecord: undefined,
      },
    });
    expect(tt.achievements.marathonSetRecord).toStrictEqual({ score: 12, holder: "alice" });
  });

  it("does NOT award when winning score is 11 or loser scored less than 10", () => {
    const events: EventType[] = [
      ...baseEvents,
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "g1",
        time: 100,
        data: { winner: "alice", loser: "bob", playedAt: 100 },
      },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g1",
        time: 101,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 0 },
          setPoints: [
            { gameWinner: 11, gameLoser: 9 }, // not deuce
            { gameWinner: 13, gameLoser: 9 }, // winner >= 12 but loser < 10
          ],
        },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "marathon-set")).toHaveLength(0);
    expect(tt.achievements.marathonSetRecord).toStrictEqual({ score: undefined, holder: undefined });
  });

  it("ties do NOT award (strictly greater only)", () => {
    const events: EventType[] = [
      ...baseEvents,
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "g1",
        time: 100,
        data: { winner: "alice", loser: "bob", playedAt: 100 },
      },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g1",
        time: 101,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 0 },
          setPoints: [
            { gameWinner: 15, gameLoser: 13 },
            { gameWinner: 11, gameLoser: 0 },
          ],
        },
      },
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "g2",
        time: 200,
        data: { winner: "bob", loser: "carol", playedAt: 200 },
      },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g2",
        time: 201,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 0 },
          setPoints: [
            { gameWinner: 15, gameLoser: 13 }, // ties the record — should NOT award
            { gameWinner: 11, gameLoser: 0 },
          ],
        },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "marathon-set")).toHaveLength(1);
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "marathon-set")).toHaveLength(0);
    expect(tt.achievements.marathonSetRecord).toStrictEqual({ score: 15, holder: "alice" });
  });

  it("awards the set winner even if they lost the overall game", () => {
    const events: EventType[] = [
      ...baseEvents,
      // Alice wins the match 2-1; Bob wins the deuce set in the middle
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "g1",
        time: 100,
        data: { winner: "alice", loser: "bob", playedAt: 100 },
      },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g1",
        time: 101,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 1 },
          setPoints: [
            { gameWinner: 11, gameLoser: 5 },
            { gameWinner: 13, gameLoser: 15 }, // Bob (game loser) wins this deuce set 15-13
            { gameWinner: 11, gameLoser: 6 },
          ],
        },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceAwards = tt.achievements.getAchievements("alice").filter((a) => a.type === "marathon-set");
    const bobAwards = tt.achievements.getAchievements("bob").filter((a) => a.type === "marathon-set");
    expect(aliceAwards).toHaveLength(0);
    expect(bobAwards).toHaveLength(1);
    expect(bobAwards[0].data).toStrictEqual({
      gameId: "g1",
      opponent: "alice",
      setWinnerScore: 15,
      setLoserScore: 13,
      previousRecord: undefined,
    });
  });

  it("can award multiple times in one game when multiple sets each beat the running record", () => {
    const events: EventType[] = [
      ...baseEvents,
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "g1",
        time: 100,
        data: { winner: "alice", loser: "bob", playedAt: 100 },
      },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g1",
        time: 101,
        data: {
          setsWon: { gameWinner: 3, gameLoser: 0 },
          setPoints: [
            { gameWinner: 12, gameLoser: 10 }, // beats 11 -> award, record=12
            { gameWinner: 14, gameLoser: 12 }, // beats 12 -> award, record=14
            { gameWinner: 13, gameLoser: 11 }, // beats neither -> no award
          ],
        },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceAwards = tt.achievements
      .getAchievements("alice")
      .filter((a) => a.type === "marathon-set")
      .sort((a, b) => (a.data!.setWinnerScore - b.data!.setWinnerScore));
    expect(aliceAwards).toHaveLength(2);
    expect(aliceAwards[0].data).toStrictEqual({
      gameId: "g1",
      opponent: "bob",
      setWinnerScore: 12,
      setLoserScore: 10,
      previousRecord: undefined,
    });
    expect(aliceAwards[1].data).toStrictEqual({
      gameId: "g1",
      opponent: "bob",
      setWinnerScore: 14,
      setLoserScore: 12,
      previousRecord: 12,
    });
    expect(tt.achievements.marathonSetRecord).toStrictEqual({ score: 14, holder: "alice" });
  });

  it("progression target and recordHolder are undefined when no record has been set", () => {
    const events: EventType[] = [
      ...baseEvents,
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "g1",
        time: 100,
        data: { winner: "alice", loser: "bob", playedAt: 100 },
      },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g1",
        time: 101,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 0 },
          setPoints: [
            { gameWinner: 11, gameLoser: 9 },
            { gameWinner: 11, gameLoser: 7 },
          ],
        },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceProg = tt.achievements.getPlayerProgression("alice")["marathon-set"];
    expect(aliceProg.current).toBe(0);
    expect(aliceProg.target).toBeUndefined();
    expect(aliceProg.recordHolder).toBeUndefined();
    expect(aliceProg.earned).toBe(0);
  });

  it("progression shows player's personal best deuce-set winning score vs the league record", () => {
    const events: EventType[] = [
      ...baseEvents,
      // Alice sets the record at 14
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "g1",
        time: 100,
        data: { winner: "alice", loser: "bob", playedAt: 100 },
      },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g1",
        time: 101,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 0 },
          setPoints: [
            { gameWinner: 14, gameLoser: 12 },
            { gameWinner: 11, gameLoser: 4 },
          ],
        },
      },
      // Bob wins a deuce set at 13 (below the record)
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "g2",
        time: 200,
        data: { winner: "bob", loser: "carol", playedAt: 200 },
      },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g2",
        time: 201,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 0 },
          setPoints: [
            { gameWinner: 13, gameLoser: 11 },
            { gameWinner: 11, gameLoser: 6 },
          ],
        },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceProg = tt.achievements.getPlayerProgression("alice")["marathon-set"];
    expect(aliceProg.current).toBe(14);
    expect(aliceProg.target).toBe(14);
    expect(aliceProg.recordHolder).toBe("alice");
    expect(aliceProg.earned).toBe(1);

    const bobProg = tt.achievements.getPlayerProgression("bob")["marathon-set"];
    expect(bobProg.current).toBe(13);
    expect(bobProg.target).toBe(14);
    expect(bobProg.recordHolder).toBe("alice");
    expect(bobProg.earned).toBe(0);

    const carolProg = tt.achievements.getPlayerProgression("carol")["marathon-set"];
    expect(carolProg.current).toBe(0);
    expect(carolProg.target).toBe(14);
    expect(carolProg.recordHolder).toBe("alice");
    expect(carolProg.earned).toBe(0);
  });
});
