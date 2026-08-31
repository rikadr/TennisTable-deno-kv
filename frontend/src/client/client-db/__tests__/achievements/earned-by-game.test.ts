import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

/**
 * The `earnedByGame` link: which game earned each achievement, and which
 * achievements a game earned.
 */
describe("Achievements earned by a game", () => {
  const player = (id: string, time: number): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: id.toUpperCase() },
  });

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  const players = [player("a", 1), player("b", 2), player("c", 3)];

  function calculate(events: EventType[]): TennisTable {
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();
    return tt;
  }

  it("links a first game to both players of that game", () => {
    const tt = calculate([...players, game("g1", 1_000, "a", "b")]);

    const earned = tt.achievements.getAchievementsEarnedByGame("g1");
    expect(
      earned
        .filter((a) => a.type === "first-game")
        .map((a) => a.earnedBy)
        .sort(),
    ).toEqual(["a", "b"]);
    earned.forEach((achievement) => expect(achievement.earnedByGame).toBe("g1"));
  });

  it("returns nothing for a game that earned nothing, and for an unknown game", () => {
    const tt = calculate([...players, game("g1", 1_000, "a", "b"), game("g2", 2_000, "a", "b")]);

    // The second game between the same 2 players repeats what the first did.
    expect(tt.achievements.getAchievementsEarnedByGame("g2")).toEqual([]);
    expect(tt.achievements.getAchievementsEarnedByGame("no-such-game")).toEqual([]);
  });

  it("links a Perfect Day to the last win of the day, not to the end of the day", () => {
    // 5 wins on one past day, at 09:00 to 13:00.
    const day = new Date(2024, 0, 15);
    const wins = [0, 1, 2, 3, 4].map((i) =>
      game(
        `g${i}`,
        new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9 + i).getTime(),
        "a",
        i % 2 ? "b" : "c",
      ),
    );
    const tt = calculate([...players, ...wins]);

    const perfectDay = tt.achievements.getAchievements("a").find((a) => a.type === "perfect-day");
    expect(perfectDay).toBeDefined();
    // The 5th win of the day earns it, hours before the day is over.
    expect(perfectDay?.earnedByGame).toBe("g4");
    expect(tt.achievements.getAchievementsEarnedByGame("g4")).toContain(perfectDay);
  });

  it("moves a streak record to the game that extends it", () => {
    // A beats B 4 times in a row. The record starts at 3 straight wins and
    // grows with the 4th.
    const wins = [1, 2, 3, 4].map((i) => game(`w${i}`, i * 1_000, "a", "b"));
    const tt = calculate([...players, ...wins]);

    const record = tt.achievements.getAchievements("a").find((a) => a.type === "longest-win-streak");
    expect(record).toBeDefined();
    expect(record?.type === "longest-win-streak" && record.data.streakLength).toBe(4);
    // One award, held by one game: the last one it grew with.
    expect(record?.earnedByGame).toBe("w4");
    expect(tt.achievements.getAchievementsEarnedByGame("w3")).not.toContain(record);
    expect(tt.achievements.getAchievementsEarnedByGame("w4")).toContain(record);
  });

  it("gives no game to an achievement that no single game earns", () => {
    const events: EventType[] = [
      ...players,
      game("g1", 1_000, "a", "b"),
      { time: 2_000, stream: "a", type: EventTypeEnum.PLAYER_DEACTIVATED, data: null },
    ];
    const tt = calculate(events);

    const retired = tt.achievements.getAchievements("a").find((a) => a.type === "retired");
    expect(retired).toBeDefined();
    expect(retired?.earnedByGame).toBeUndefined();
    expect("earnedByGame" in (retired ?? {})).toBe(false);
  });
});
