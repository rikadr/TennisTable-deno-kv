import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("Streak Ender Achievement", () => {
  const players: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "dave", time: 4, data: { name: "Dave" } },
  ];

  function aliceWinsAgainst(opponents: string[], startTime = 1000, step = 10): EventType[] {
    return opponents.map((opponent, i) => ({
      type: EventTypeEnum.GAME_CREATED,
      stream: `g-alice-${i + 1}`,
      time: startTime + (i + 1) * step,
      data: { winner: "alice", loser: opponent, playedAt: startTime + (i + 1) * step },
    }));
  }

  it("awards the winner when the loser was on a 10+ game win streak", () => {
    const aliceWins = aliceWinsAgainst(["bob", "carol", "dave", "bob", "carol", "dave", "bob", "carol", "dave", "bob"]);
    const events: EventType[] = [
      ...players,
      ...aliceWins,
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "ender",
        time: 5000,
        data: { winner: "carol", loser: "alice", playedAt: 5000 },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const carolEnders = tt.achievements.getAchievements("carol").filter((a) => a.type === "streak-ender");
    expect(carolEnders).toHaveLength(1);
    expect(carolEnders[0]).toStrictEqual({
      type: "streak-ender",
      earnedBy: "carol",
      earnedAt: 5000,
      data: {
        opponent: "alice",
        gameId: "ender",
        streakLength: 10,
      },
    });
  });

  it("does NOT award when the loser was on a 9-game streak", () => {
    const aliceWins = aliceWinsAgainst(["bob", "carol", "dave", "bob", "carol", "dave", "bob", "carol", "dave"]);
    const events: EventType[] = [
      ...players,
      ...aliceWins,
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "no-ender",
        time: 5000,
        data: { winner: "bob", loser: "alice", playedAt: 5000 },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "streak-ender")).toHaveLength(0);
  });

  it("records the actual streak length when the loser was on a long (15+) streak", () => {
    const opponents = [
      "bob", "carol", "dave", "bob", "carol",
      "dave", "bob", "carol", "dave", "bob",
      "carol", "dave", "bob", "carol", "dave",
    ];
    const aliceWins = aliceWinsAgainst(opponents);
    const events: EventType[] = [
      ...players,
      ...aliceWins,
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "ender",
        time: 9000,
        data: { winner: "dave", loser: "alice", playedAt: 9000 },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const daveEnders = tt.achievements.getAchievements("dave").filter((a) => a.type === "streak-ender");
    expect(daveEnders).toHaveLength(1);
    expect(daveEnders[0].data).toStrictEqual({
      opponent: "alice",
      gameId: "ender",
      streakLength: 15,
    });
  });

  it("can be earned multiple times by the same player against different opponents", () => {
    const aliceWins = aliceWinsAgainst(
      ["bob", "carol", "dave", "bob", "carol", "dave", "bob", "carol", "dave", "bob"],
      1000,
    );
    // Carol ends Alice's streak.
    const carolEnds: EventType = {
      type: EventTypeEnum.GAME_CREATED,
      stream: "carol-ends",
      time: 5000,
      data: { winner: "carol", loser: "alice", playedAt: 5000 },
    };
    // Bob now goes on a 10+ streak (against Alice and Dave).
    const bobOpponents = ["alice", "dave", "alice", "dave", "alice", "dave", "alice", "dave", "alice", "dave"];
    const bobWins: EventType[] = bobOpponents.map((opp, i) => ({
      type: EventTypeEnum.GAME_CREATED,
      stream: `bob-w-${i + 1}`,
      time: 6000 + (i + 1) * 10,
      data: { winner: "bob", loser: opp, playedAt: 6000 + (i + 1) * 10 },
    }));
    // Carol ends Bob's streak too.
    const carolEndsBob: EventType = {
      type: EventTypeEnum.GAME_CREATED,
      stream: "carol-ends-bob",
      time: 9000,
      data: { winner: "carol", loser: "bob", playedAt: 9000 },
    };

    const tt = new TennisTable({
      events: [...players, ...aliceWins, carolEnds, ...bobWins, carolEndsBob],
    });
    tt.achievements.calculateAchievements();

    const carolEnders = tt.achievements.getAchievements("carol").filter((a) => a.type === "streak-ender");
    expect(carolEnders).toHaveLength(2);
    expect(carolEnders.map((a) => a.data.opponent).sort()).toStrictEqual(["alice", "bob"]);
  });

  it("progression counts earned achievements", () => {
    const aliceWins = aliceWinsAgainst(["bob", "carol", "dave", "bob", "carol", "dave", "bob", "carol", "dave", "bob"]);
    const events: EventType[] = [
      ...players,
      ...aliceWins,
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "ender",
        time: 5000,
        data: { winner: "dave", loser: "alice", playedAt: 5000 },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("dave")["streak-ender"]).toStrictEqual({ earned: 1 });
    expect(tt.achievements.getPlayerProgression("bob")["streak-ender"]).toStrictEqual({ earned: 0 });
  });
});
