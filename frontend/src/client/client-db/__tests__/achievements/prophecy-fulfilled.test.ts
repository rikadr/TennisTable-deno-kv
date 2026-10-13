import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Prophecy Fulfilled: the score reaches the expected score after it was 100 or
// more below it. The expected scores are checked after the last game of each
// local calendar day that is over.
//
// The predictions weigh old games less, but the score counts all games. So
// after many old losses, Alice's score is far below her expected score.

describe("Prophecy Fulfilled Achievement", () => {
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

  const MINUTE = 60 * 1000;
  const oldDay = new Date(2022, 0, 1, 12).getTime();
  const day1 = new Date(2024, 0, 1, 12).getTime();
  const day2 = new Date(2024, 0, 2, 12).getTime();

  // 2 years ago Bob won 30 games. On day 1 they take turns to win, so the
  // prediction is near 50%, but Alice's score is still far below Bob's.
  const history = (): EventType[] => [
    ...Array.from({ length: 30 }, (_, i) => game(`old${i + 1}`, oldDay + i * MINUTE, "bob", "alice")),
    ...Array.from({ length: 6 }, (_, i) =>
      i % 2 === 0
        ? game(`d${i + 1}`, day1 + i * MINUTE, "alice", "bob")
        : game(`d${i + 1}`, day1 + i * MINUTE, "bob", "alice"),
    ),
  ];
  // On day 2 Alice wins all games.
  const aliceWins = (count: number): EventType[] =>
    Array.from({ length: count }, (_, i) => game(`w${i + 1}`, day2 + i * MINUTE, "alice", "bob"));

  const prophecyAwards = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "prophecy-fulfilled");

  it("arms a player whose score is 100 or more below the expected score", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...history()], gameLimitForRankedOverride: 5 });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getPlayerProgression("alice")["prophecy-fulfilled"];
    expect(alice.armed).toBe(true);
    expect(alice.gap).toBeGreaterThanOrEqual(100);
    expect(tt.achievements.getPlayerProgression("bob")["prophecy-fulfilled"].armed).toBe(false);
    expect(prophecyAwards(tt, "alice")).toHaveLength(0);
  });

  it("awards the player at the end of the day the score reaches the expected score", () => {
    const tt = new TennisTable({
      events: [...baseEvents, ...history(), ...aliceWins(48)],
      gameLimitForRankedOverride: 5,
    });
    tt.achievements.calculateAchievements();

    const awards = prophecyAwards(tt, "alice");
    expect(awards).toHaveLength(1);
    expect(awards[0].earnedByGame).toBe("w48");
    expect(awards[0].earnedAt).toBe(day2 + 47 * MINUTE);
    expect(awards[0].data.score).toBeGreaterThanOrEqual(awards[0].data.expectedScore);
    expect(awards[0].data.largestGap).toBeGreaterThanOrEqual(100);
    expect(awards[0].data.armedAt).toBe(day1 + 5 * MINUTE);
    expect(prophecyAwards(tt, "bob")).toHaveLength(0);
  });

  it("does not award before the score reaches the expected score", () => {
    const tt = new TennisTable({
      events: [...baseEvents, ...history(), ...aliceWins(24)],
      gameLimitForRankedOverride: 5,
    });
    tt.achievements.calculateAchievements();

    expect(prophecyAwards(tt, "alice")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("alice")["prophecy-fulfilled"].armed).toBe(true);
  });

  it("does not check a day that is not over", () => {
    const tt = new TennisTable({
      events: [...baseEvents, ...history(), ...aliceWins(48)],
      gameLimitForRankedOverride: 5,
      referenceTime: day2 + 48 * MINUTE,
    });
    tt.achievements.calculateAchievements();

    expect(prophecyAwards(tt, "alice")).toHaveLength(0);
  });
});
