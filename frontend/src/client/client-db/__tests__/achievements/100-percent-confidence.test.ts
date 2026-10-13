import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// 100% Confidence: after a game, the prediction for the pair reaches 100% confidence.
// Both players earn it, 1 time for each pair.
//
// The games have no score, so each game adds only its game result. Between 2
// even players the confidence is 1 - 2^(-games / 10), which shows as 100%
// from 77 games.

describe("100% Confidence Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
  ];

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    type: EventTypeEnum.GAME_CREATED,
    stream: id,
    time,
    data: { winner, loser, playedAt: time },
  });

  // The 2 players take turns to win, the first player first.
  const alternatingGames = (p1: string, p2: string, count: number, startTime: number): EventType[] =>
    Array.from({ length: count }, (_, i) =>
      game(`${p1}-${p2}-${i + 1}`, startTime + i, i % 2 === 0 ? p1 : p2, i % 2 === 0 ? p2 : p1),
    );

  const hundredPercentAwards = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "100-percent-confidence");

  it("awards both players at the game that takes the confidence to 100%", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...alternatingGames("alice", "bob", 100, 100)] });
    tt.achievements.calculateAchievements();

    for (const [playerId, opponent] of [
      ["alice", "bob"],
      ["bob", "alice"],
    ]) {
      const awards = hundredPercentAwards(tt, playerId);
      expect(awards).toHaveLength(1);
      expect(awards[0].earnedByGame).toBe("alice-bob-77");
      expect(awards[0].earnedAt).toBe(176);
      expect(awards[0].data).toEqual({ gameId: "alice-bob-77", opponent, gamesPlayed: 77 });
    }
  });

  it("does not award before the confidence reaches 100%", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...alternatingGames("alice", "bob", 76, 100)] });
    tt.achievements.calculateAchievements();

    expect(hundredPercentAwards(tt, "alice")).toHaveLength(0);
    expect(hundredPercentAwards(tt, "bob")).toHaveLength(0);
  });

  it("awards 1 time for each pair", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        ...alternatingGames("alice", "bob", 100, 100),
        ...alternatingGames("alice", "carol", 100, 1000),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(
      hundredPercentAwards(tt, "alice")
        .map((award) => award.data.opponent)
        .sort(),
    ).toEqual(["bob", "carol"]);
    expect(hundredPercentAwards(tt, "bob").map((award) => award.data.opponent)).toEqual(["alice"]);
    expect(hundredPercentAwards(tt, "carol").map((award) => award.data.opponent)).toEqual(["alice"]);
  });

  it("shows progress as the highest confidence with an opponent without the award", () => {
    // Progress uses the confidence now, so the games are recent. Old games have
    // almost no age weight.
    const start = Date.now() - 60 * 60 * 1000;
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        ...alternatingGames("alice", "bob", 100, start),
        ...alternatingGames("alice", "carol", 20, start + 1000),
      ],
    });
    tt.achievements.calculateAchievements();

    // Bob gave the award, so Carol is the closest opponent.
    const alice = tt.achievements.getPlayerProgression("alice")["100-percent-confidence"];
    expect(alice.earned).toBe(1);
    expect(alice.closestOpponent).toBe("carol");
    expect(alice.current).toBeGreaterThan(0);
    expect(alice.current).toBeLessThan(100);
    expect(alice.target).toBe(100);

    // Carol has no award, and Alice is her only opponent.
    const carol = tt.achievements.getPlayerProgression("carol")["100-percent-confidence"];
    expect(carol.earned).toBe(0);
    expect(carol.closestOpponent).toBe("alice");
    expect(carol.current).toBe(alice.current);
  });
});
