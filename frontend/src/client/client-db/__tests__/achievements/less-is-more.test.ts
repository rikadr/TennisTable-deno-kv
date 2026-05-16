import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("Less Is More Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
  ];

  it("awards the winner when they scored fewer total points across the match", () => {
    // Alice wins 2-1 with: 11-9, 5-11, 11-9 → Alice 27, Bob 29
    const events: EventType[] = [
      ...baseEvents,
      { type: EventTypeEnum.GAME_CREATED, stream: "g1", time: 100, data: { winner: "alice", loser: "bob", playedAt: 100 } },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g1",
        time: 101,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 1 },
          setPoints: [
            { gameWinner: 11, gameLoser: 9 },
            { gameWinner: 5, gameLoser: 11 },
            { gameWinner: 11, gameLoser: 9 },
          ],
        },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceAwards = tt.achievements.getAchievements("alice").filter((a) => a.type === "less-is-more");
    const bobAwards = tt.achievements.getAchievements("bob").filter((a) => a.type === "less-is-more");

    expect(aliceAwards).toHaveLength(1);
    expect(bobAwards).toHaveLength(0);
    expect(aliceAwards[0]).toStrictEqual({
      type: "less-is-more",
      earnedBy: "alice",
      earnedAt: 100,
      data: { gameId: "g1", opponent: "bob", playerPoints: 27, opponentPoints: 29 },
    });
  });

  it("does NOT award when the winner scored equal or more total points", () => {
    // Standard 2-0 win: 11-9, 11-9 → Alice 22, Bob 18
    const events: EventType[] = [
      ...baseEvents,
      { type: EventTypeEnum.GAME_CREATED, stream: "g1", time: 100, data: { winner: "alice", loser: "bob", playedAt: 100 } },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g1",
        time: 101,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 0 },
          setPoints: [
            { gameWinner: 11, gameLoser: 9 },
            { gameWinner: 11, gameLoser: 9 },
          ],
        },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "less-is-more")).toHaveLength(0);
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "less-is-more")).toHaveLength(0);
  });

  it("can be earned multiple times across multiple games", () => {
    const events: EventType[] = [
      ...baseEvents,
      { type: EventTypeEnum.GAME_CREATED, stream: "g1", time: 100, data: { winner: "alice", loser: "bob", playedAt: 100 } },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g1",
        time: 101,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 1 },
          setPoints: [
            { gameWinner: 11, gameLoser: 9 },
            { gameWinner: 5, gameLoser: 11 },
            { gameWinner: 11, gameLoser: 9 },
          ],
        },
      },
      { type: EventTypeEnum.GAME_CREATED, stream: "g2", time: 200, data: { winner: "alice", loser: "bob", playedAt: 200 } },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: "g2",
        time: 201,
        data: {
          setsWon: { gameWinner: 2, gameLoser: 1 },
          setPoints: [
            { gameWinner: 11, gameLoser: 8 },
            { gameWinner: 2, gameLoser: 11 },
            { gameWinner: 11, gameLoser: 9 },
          ],
        },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const awards = tt.achievements.getAchievements("alice").filter((a) => a.type === "less-is-more");
    expect(awards).toHaveLength(2);

    const progression = tt.achievements.getPlayerProgression("alice");
    expect(progression["less-is-more"]).toStrictEqual({ earned: 2 });
  });
});
