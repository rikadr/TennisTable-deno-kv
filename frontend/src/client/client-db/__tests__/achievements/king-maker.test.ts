import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

describe("King Maker Achievement", () => {
  const players: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "dan", time: 4, data: { name: "Dan" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "eve", time: 5, data: { name: "Eve" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "frank", time: 6, data: { name: "Frank" } },
  ];

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  it("awards King Maker to the sole opponent on the climb", () => {
    // Carol/Dan/Eve/Frank trade wins to enter the ranked pool around 1000.
    // Then Alice beats Bob twice; her 2nd win crowns her at rank #1.
    // Bob is the only opponent contributing positive net Elo to Alice → Bob is King Maker.
    const events: EventType[] = [
      ...players,
      game("f1", 100, "carol", "dan"),
      game("f2", 101, "dan", "carol"),
      game("f3", 102, "eve", "frank"),
      game("f4", 103, "frank", "eve"),
      game("ab1", 200, "alice", "bob"),
      game("ab2", 201, "alice", "bob"),
    ];

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 1 });
    tt.achievements.calculateAchievements();

    const aliceThrone = tt.achievements.getAchievements("alice").filter((a) => a.type === "touched-the-throne");
    expect(aliceThrone).toHaveLength(1);

    const bobKing = tt.achievements.getAchievements("bob").filter((a) => a.type === "king-maker");
    expect(bobKing).toHaveLength(1);
    expect(bobKing[0].data?.newKing).toBe("alice");
    expect(bobKing[0].data?.netScoreGained).toBeGreaterThan(0);

    // No other player should have been awarded King Maker for Alice.
    for (const p of ["alice", "carol", "dan", "eve", "frank"]) {
      expect(tt.achievements.getAchievements(p).filter((a) => a.type === "king-maker")).toHaveLength(0);
    }
  });

  it("picks the opponent with the largest net positive gain", () => {
    // Alice beats Bob 4 times (large net gain) and Carol once (small gain).
    // Bob should be King Maker even though Alice beat Carol last.
    const events: EventType[] = [
      ...players,
      game("f1", 100, "dan", "eve"),
      game("f2", 101, "eve", "dan"),
      game("f3", 102, "frank", "dan"),
      game("f4", 103, "dan", "frank"),
      // Alice climbs against Bob
      game("ab1", 200, "alice", "bob"),
      game("ab2", 201, "alice", "bob"),
      game("ab3", 202, "alice", "bob"),
      game("ab4", 203, "alice", "bob"),
      // And a final, smaller win against Carol that triggers the throne
      game("ac1", 300, "alice", "carol"),
    ];

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 1 });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "touched-the-throne")).toHaveLength(1);

    const bobKing = tt.achievements.getAchievements("bob").filter((a) => a.type === "king-maker");
    const carolKing = tt.achievements.getAchievements("carol").filter((a) => a.type === "king-maker");
    expect(bobKing).toHaveLength(1);
    expect(carolKing).toHaveLength(0);
    expect(bobKing[0].data?.newKing).toBe("alice");
  });

  it("awards a separate King Maker for each new king", () => {
    // Two distinct climbs. Each new king gets their own King Maker awarded
    // to their biggest contributor. Bob helps Alice; Frank helps Eve.
    const events: EventType[] = [
      ...players,
      game("seed1", 100, "carol", "dan"),
      game("seed2", 101, "dan", "carol"),
      // Alice climbs against Bob
      game("ab1", 200, "alice", "bob"),
      game("ab2", 201, "alice", "bob"),
      // Now invalidate Alice's reign so Eve can climb later. Easiest: just
      // have Eve climb past Alice via wins against Frank.
      game("ef1", 300, "eve", "frank"),
      game("ef2", 301, "eve", "frank"),
      game("ef3", 302, "eve", "frank"),
      game("ef4", 303, "eve", "frank"),
    ];

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 1 });
    tt.achievements.calculateAchievements();

    const aliceThrone = tt.achievements.getAchievements("alice").filter((a) => a.type === "touched-the-throne");
    const eveThrone = tt.achievements.getAchievements("eve").filter((a) => a.type === "touched-the-throne");
    expect(aliceThrone).toHaveLength(1);
    expect(eveThrone).toHaveLength(1);

    const bobKing = tt.achievements.getAchievements("bob").filter((a) => a.type === "king-maker");
    const frankKing = tt.achievements.getAchievements("frank").filter((a) => a.type === "king-maker");
    expect(bobKing).toHaveLength(1);
    expect(bobKing[0].data?.newKing).toBe("alice");
    expect(frankKing).toHaveLength(1);
    expect(frankKing[0].data?.newKing).toBe("eve");
  });
});
