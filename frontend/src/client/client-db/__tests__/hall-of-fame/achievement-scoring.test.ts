import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import {
  ACHIEVEMENT_SCORE_TIERS,
  ACHIEVEMENT_SCORES,
  DEFAULT_ACHIEVEMENT_SCORE,
  getAchievementScore,
} from "../../achievements";

// The Hall of Fame "achievements earned" factor sums a static per-type
// weight (10 / 20 / 30) instead of a flat 20-per-achievement, and reports
// how many were earned at each weight tier.

describe("Weighted achievement scoring", () => {
  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  const players = (): EventType[] => [
    { time: 1, stream: "alice", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
    { time: 2, stream: "bob", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
  ];

  it("assigns a weight in an allowed tier to every achievement type", () => {
    for (const weight of Object.values(ACHIEVEMENT_SCORES)) {
      expect(ACHIEVEMENT_SCORE_TIERS).toContain(weight);
    }
  });

  it("getAchievementScore falls back to the default for unknown types", () => {
    expect(getAchievementScore("first-game")).toBe(10);
    expect(getAchievementScore("touched-the-throne")).toBe(30);
    expect(getAchievementScore("not-a-real-achievement")).toBe(DEFAULT_ACHIEVEMENT_SCORE);
  });

  it("scores achievements by their weight and tallies each tier", () => {
    const events: EventType[] = [...players(), game("g1", 100, "alice", "bob")];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const earned = tt.achievements.getAchievements("alice");
    const expectedScore = earned.reduce((sum, a) => sum + getAchievementScore(a.type), 0);

    const entry = tt.hallOfFame.getScoreForAnyPlayer("alice");
    expect(entry).toBeDefined();

    const breakdown = entry!.score.achievementsEarned;
    expect(breakdown.count).toBe(earned.length);
    expect(breakdown.score).toBe(expectedScore);

    // Only "first-game" (weight 10) is earned from a single game.
    expect(earned.map((a) => a.type)).toEqual(["first-game"]);
    expect(breakdown.score).toBe(10);

    // All tiers are represented, in ascending order, with per-tier counts.
    expect(breakdown.byWeight.map((t) => t.weight)).toEqual([...ACHIEVEMENT_SCORE_TIERS]);
    expect(breakdown.byWeight).toEqual([
      { weight: 10, count: 1 },
      { weight: 20, count: 0 },
      { weight: 30, count: 0 },
    ]);
  });

  it("sums mixed-weight achievements and counts them per tier", () => {
    // Give Alice a spread of achievements across tiers by playing enough
    // games: first-game (10) + ranked (10) + donut sets, and a 10-win
    // streak (streak-all-10, weight 30).
    const events: EventType[] = [...players()];
    let t = 100;
    // 10 straight wins for Alice, each a donut set (bob scores 0), which
    // also crosses the ranked threshold and the 10-game win streak.
    for (let i = 0; i < 10; i++) {
      events.push({
        time: t,
        stream: `g${i}`,
        type: EventTypeEnum.GAME_CREATED,
        data: {
          playedAt: t,
          winner: "alice",
          loser: "bob",
          score: { setsWon: { gameWinner: 1, gameLoser: 0 }, setPoints: [{ gameWinner: 11, gameLoser: 0 }] },
        },
      });
      t += 1000;
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const earned = tt.achievements.getAchievements("alice");
    const expectedScore = earned.reduce((sum, a) => sum + getAchievementScore(a.type), 0);

    const breakdown = tt.hallOfFame.getScoreForAnyPlayer("alice")!.score.achievementsEarned;
    expect(breakdown.score).toBe(expectedScore);
    expect(breakdown.count).toBe(earned.length);

    // Per-tier counts must add up to the total count.
    const tierTotal = breakdown.byWeight.reduce((sum, tier) => sum + tier.count, 0);
    expect(tierTotal).toBe(breakdown.count);

    // Each tier's count matches an independent tally of the earned types.
    for (const tier of breakdown.byWeight) {
      const expectedCount = earned.filter((a) => getAchievementScore(a.type) === tier.weight).length;
      expect(tier.count).toBe(expectedCount);
    }

    // Alice earned at least one rare (30-pt) achievement (streak-all-10).
    expect(earned.some((a) => a.type === "streak-all-10")).toBe(true);
    expect(breakdown.byWeight.find((tier) => tier.weight === 30)!.count).toBeGreaterThan(0);
  });
});
