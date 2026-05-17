import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("Group Stage Star Achievement", () => {
  const players: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "dave", time: 4, data: { name: "Dave" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "eve", time: 5, data: { name: "Eve" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "frank", time: 6, data: { name: "Frank" } },
  ];

  const PAST_START = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const FUTURE_START = Date.now() + 30 * 24 * 60 * 60 * 1000;

  function game(stream: string, time: number, winner: string, loser: string): EventType {
    return {
      type: EventTypeEnum.GAME_CREATED,
      stream,
      time,
      data: { winner, loser, playedAt: time },
    };
  }

  it("awards the player who went undefeated in a finished 4-player group", () => {
    const events: EventType[] = [
      ...players,
      {
        type: EventTypeEnum.TOURNAMENT_CREATED,
        stream: "t1",
        time: 1000,
        data: { name: "Spring Cup", startDate: PAST_START, groupPlay: true },
      },
      {
        type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
        stream: "t1",
        time: 1001,
        data: { playerOrder: ["alice", "bob", "carol", "dave"] },
      },
      // Alice wins all 3 of her games.
      game("g1", PAST_START + 100, "alice", "bob"),
      game("g2", PAST_START + 200, "alice", "carol"),
      game("g3", PAST_START + 300, "alice", "dave"),
      // Remaining games to complete the group stage.
      game("g4", PAST_START + 400, "bob", "carol"),
      game("g5", PAST_START + 500, "bob", "dave"),
      game("g6", PAST_START + 600, "carol", "dave"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceAwards = tt.achievements.getAchievements("alice").filter((a) => a.type === "group-stage-star");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0]).toStrictEqual({
      type: "group-stage-star",
      earnedBy: "alice",
      earnedAt: PAST_START + 600,
      data: { tournamentId: "t1", wins: 3 },
    });

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "group-stage-star")).toHaveLength(0);
    expect(tt.achievements.getAchievements("carol").filter((a) => a.type === "group-stage-star")).toHaveLength(0);
    expect(tt.achievements.getAchievements("dave").filter((a) => a.type === "group-stage-star")).toHaveLength(0);
  });

  it("does NOT award while the group stage is still in progress (some games pending)", () => {
    const events: EventType[] = [
      ...players,
      {
        type: EventTypeEnum.TOURNAMENT_CREATED,
        stream: "t1",
        time: 1000,
        data: { name: "In-progress Cup", startDate: PAST_START, groupPlay: true },
      },
      {
        type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
        stream: "t1",
        time: 1001,
        data: { playerOrder: ["alice", "bob", "carol", "dave"] },
      },
      // Alice plays and wins all her games but the rest is incomplete.
      game("g1", PAST_START + 100, "alice", "bob"),
      game("g2", PAST_START + 200, "alice", "carol"),
      game("g3", PAST_START + 300, "alice", "dave"),
      game("g4", PAST_START + 400, "bob", "carol"),
      // g5 (bob vs dave) and g6 (carol vs dave) missing → group play not ended.
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "group-stage-star")).toHaveLength(0);
  });

  it("does NOT award for tournaments without group play", () => {
    const events: EventType[] = [
      ...players,
      {
        type: EventTypeEnum.TOURNAMENT_CREATED,
        stream: "t1",
        time: 1000,
        data: { name: "Knockout Only", startDate: PAST_START, groupPlay: false },
      },
      {
        type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
        stream: "t1",
        time: 1001,
        data: { playerOrder: ["alice", "bob", "carol", "dave"] },
      },
      game("g1", PAST_START + 100, "alice", "bob"),
      game("g2", PAST_START + 200, "alice", "carol"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "group-stage-star")).toHaveLength(0);
  });

  it("does NOT award for a tournament that has not started yet", () => {
    const events: EventType[] = [
      ...players,
      {
        type: EventTypeEnum.TOURNAMENT_CREATED,
        stream: "t1",
        time: 1000,
        data: { name: "Future Cup", startDate: FUTURE_START, groupPlay: true },
      },
      {
        type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
        stream: "t1",
        time: 1001,
        data: { playerOrder: ["alice", "bob", "carol", "dave"] },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "group-stage-star")).toHaveLength(0);
  });

  it("awards one undefeated player per group when there are multiple groups", () => {
    const events: EventType[] = [
      ...players,
      {
        type: EventTypeEnum.TOURNAMENT_CREATED,
        stream: "t1",
        time: 1000,
        data: { name: "Two Groups", startDate: PAST_START, groupPlay: true, overridePreferredGroupSize: 3 },
      },
      {
        type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
        stream: "t1",
        time: 1001,
        data: { playerOrder: ["alice", "bob", "carol", "dave", "eve", "frank"] },
      },
      // Group A (alice, dave, eve based on seeding) — wins for alice
      // The exact group assignment uses the snake/seed algorithm; just play
      // every cross pairing so whatever groups form, the right players have
      // all their games done.
      game("g1", PAST_START + 100, "alice", "bob"),
      game("g2", PAST_START + 200, "alice", "carol"),
      game("g3", PAST_START + 300, "alice", "dave"),
      game("g4", PAST_START + 400, "alice", "eve"),
      game("g5", PAST_START + 500, "alice", "frank"),
      game("g6", PAST_START + 600, "bob", "carol"),
      game("g7", PAST_START + 700, "bob", "dave"),
      game("g8", PAST_START + 800, "bob", "eve"),
      game("g9", PAST_START + 900, "bob", "frank"),
      game("g10", PAST_START + 1000, "carol", "dave"),
      game("g11", PAST_START + 1100, "carol", "eve"),
      game("g12", PAST_START + 1200, "carol", "frank"),
      game("g13", PAST_START + 1300, "dave", "eve"),
      game("g14", PAST_START + 1400, "dave", "frank"),
      game("g15", PAST_START + 1500, "eve", "frank"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    // Whatever groups form, alice beat everyone — so she's undefeated in her group.
    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "group-stage-star")).toHaveLength(1);

    // Sanity: at most one undefeated player exists per group.
    const totalAwards = ["alice", "bob", "carol", "dave", "eve", "frank"]
      .map((p) => tt.achievements.getAchievements(p).filter((a) => a.type === "group-stage-star").length)
      .reduce((sum, n) => sum + n, 0);
    // 6 players / preferredGroupSize 3 => two groups; can be at most 2 undefeated awards.
    expect(totalAwards).toBeLessThanOrEqual(2);
    expect(totalAwards).toBeGreaterThanOrEqual(1);
  });

  it("treats opponent skips as free wins (still undefeated)", () => {
    const events: EventType[] = [
      ...players,
      {
        type: EventTypeEnum.TOURNAMENT_CREATED,
        stream: "t1",
        time: 1000,
        data: { name: "Skip Cup", startDate: PAST_START, groupPlay: true },
      },
      {
        type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
        stream: "t1",
        time: 1001,
        data: { playerOrder: ["alice", "bob", "carol", "dave"] },
      },
      // Alice wins 2 real games + 1 by Dave skipping.
      game("g1", PAST_START + 100, "alice", "bob"),
      game("g2", PAST_START + 200, "alice", "carol"),
      {
        type: EventTypeEnum.TOURNAMENT_SKIP_GAME,
        stream: "t1",
        time: PAST_START + 300,
        data: { skipId: "skip1", winner: "alice", loser: "dave" },
      },
      // Complete the rest.
      game("g4", PAST_START + 400, "bob", "carol"),
      game("g5", PAST_START + 500, "bob", "dave"),
      game("g6", PAST_START + 600, "carol", "dave"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceAwards = tt.achievements.getAchievements("alice").filter((a) => a.type === "group-stage-star");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0].data).toStrictEqual({ tournamentId: "t1", wins: 3 });
  });

  it("does NOT award when the player themselves skipped a game", () => {
    const events: EventType[] = [
      ...players,
      {
        type: EventTypeEnum.TOURNAMENT_CREATED,
        stream: "t1",
        time: 1000,
        data: { name: "Self-Skip Cup", startDate: PAST_START, groupPlay: true },
      },
      {
        type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
        stream: "t1",
        time: 1001,
        data: { playerOrder: ["alice", "bob", "carol", "dave"] },
      },
      // Alice wins 2 real games; the 3rd is recorded as her skipping (Bob wins by default).
      game("g1", PAST_START + 100, "alice", "carol"),
      game("g2", PAST_START + 200, "alice", "dave"),
      {
        type: EventTypeEnum.TOURNAMENT_SKIP_GAME,
        stream: "t1",
        time: PAST_START + 300,
        data: { skipId: "skip1", winner: "bob", loser: "alice" },
      },
      // Finish the group.
      game("g4", PAST_START + 400, "bob", "carol"),
      game("g5", PAST_START + 500, "bob", "dave"),
      game("g6", PAST_START + 600, "carol", "dave"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "group-stage-star")).toHaveLength(0);
    // Bob has 3 wins, 0 losses, 0 own-skips → he's undefeated.
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "group-stage-star")).toHaveLength(1);
  });

  it("progression counts earned achievements", () => {
    const events: EventType[] = [
      ...players,
      {
        type: EventTypeEnum.TOURNAMENT_CREATED,
        stream: "t1",
        time: 1000,
        data: { name: "Cup", startDate: PAST_START, groupPlay: true },
      },
      {
        type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
        stream: "t1",
        time: 1001,
        data: { playerOrder: ["alice", "bob", "carol", "dave"] },
      },
      game("g1", PAST_START + 100, "alice", "bob"),
      game("g2", PAST_START + 200, "alice", "carol"),
      game("g3", PAST_START + 300, "alice", "dave"),
      game("g4", PAST_START + 400, "bob", "carol"),
      game("g5", PAST_START + 500, "bob", "dave"),
      game("g6", PAST_START + 600, "carol", "dave"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("alice")["group-stage-star"]).toStrictEqual({ earned: 1 });
    expect(tt.achievements.getPlayerProgression("bob")["group-stage-star"]).toStrictEqual({ earned: 0 });
  });
});
