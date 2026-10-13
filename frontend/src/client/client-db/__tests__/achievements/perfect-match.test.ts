import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Perfect Match: after a game, the prediction for the pair is between 49.5%
// and 50.5%, at more than 50% confidence. Both players earn it, 1 time for
// each pair.
//
// The games have no score. Between 2 even players the confidence is
// 1 - 2^(-games / 10), so it is above 50% from the 11th game.

describe("Perfect Match Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
  ];

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    type: EventTypeEnum.GAME_CREATED,
    stream: id,
    time,
    data: { winner, loser, playedAt: time },
  });

  // Alice and Bob take turns to win, Alice first. After an even number of
  // games the prediction is 50%.
  const alternatingGames = (count: number): EventType[] =>
    Array.from({ length: count }, (_, i) =>
      i % 2 === 0 ? game(`g${i + 1}`, 100 + i, "alice", "bob") : game(`g${i + 1}`, 100 + i, "bob", "alice"),
    );

  const perfectMatchAwards = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "perfect-match");

  it("awards both players when the prediction is 50% above 50% confidence", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...alternatingGames(16)] });
    tt.achievements.calculateAchievements();

    for (const [playerId, opponent] of [
      ["alice", "bob"],
      ["bob", "alice"],
    ]) {
      const awards = perfectMatchAwards(tt, playerId);
      expect(awards).toHaveLength(1);
      // At 10 games the confidence is exactly 50%, so the 12th game is the first at 50% above 50% confidence.
      expect(awards[0].earnedByGame).toBe("g12");
      expect(awards[0].data).toEqual({ gameId: "g12", opponent, winChance: 50, confidence: 56.5 });
    }
  });

  it("does not award at 50% confidence or below", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...alternatingGames(10)] });
    tt.achievements.calculateAchievements();

    expect(perfectMatchAwards(tt, "alice")).toHaveLength(0);
    expect(perfectMatchAwards(tt, "bob")).toHaveLength(0);
  });

  it("does not award a prediction more than 0.5 percentage points from 50%", () => {
    // Alice wins 2 of each 3 games.
    const games = Array.from({ length: 30 }, (_, i) =>
      i % 3 === 2 ? game(`g${i + 1}`, 100 + i, "bob", "alice") : game(`g${i + 1}`, 100 + i, "alice", "bob"),
    );
    const tt = new TennisTable({ events: [...baseEvents, ...games] });
    tt.achievements.calculateAchievements();

    expect(perfectMatchAwards(tt, "alice")).toHaveLength(0);
  });

  it("shows the opponent with the prediction closest to 50% as progress", () => {
    // Progress uses the prediction now, so the games are recent. Alice wins 2
    // of each 3 games against Bob, so the pair has no award. Carol has 2
    // games, which gives less than 50% confidence, so she does not count.
    const start = Date.now() - 60 * 60 * 1000;
    const games = [
      ...Array.from({ length: 21 }, (_, i) =>
        i % 3 === 2 ? game(`g${i + 1}`, start + i, "bob", "alice") : game(`g${i + 1}`, start + i, "alice", "bob"),
      ),
      game("c1", start + 100, "alice", "carol"),
      game("c2", start + 101, "carol", "alice"),
    ];
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
        ...games,
      ],
    });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getPlayerProgression("alice")["perfect-match"];
    expect(perfectMatchAwards(tt, "alice")).toHaveLength(0);
    expect(alice.closestOpponent).toBe("bob");
    expect(alice.closestWinChance).toBeGreaterThan(50.5);
    expect(alice.closestConfidence).toBeGreaterThan(50);
  });
});
