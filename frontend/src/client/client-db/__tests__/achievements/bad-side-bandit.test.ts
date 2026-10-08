import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Bad Side Bandit: win 10 games where you played more sets on the bad side of
// the table than your opponent. "B" is a set where the game winner had the bad
// side, "G" a set where the game loser had it. "N" and unrecorded sets count
// for neither player. One-time achievement, awarded on the crossing game.

describe("Bad Side Bandit Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "chris", time: 3, data: { name: "Chris" } },
  ];

  type Side = "G" | "B" | "N" | null;

  // A game that records only the sides of its sets, not the points.
  const game = (id: string, time: number, winner: string, loser: string, sides?: Side[]): EventType[] => [
    { type: EventTypeEnum.GAME_CREATED, stream: id, time, data: { winner, loser, playedAt: time } },
    {
      type: EventTypeEnum.GAME_SCORE,
      stream: id,
      time: time + 1,
      data: { setsWon: { gameWinner: 2, gameLoser: 1 }, gameWinnerSides: sides },
    },
  ];

  const games = (count: number, winner: string, loser: string, sides?: Side[]): EventType[] =>
    Array.from({ length: count }, (_, i) => game(`g${i}`, 100 + i * 10, winner, loser, sides)).flat();

  const awardsOf = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "bad-side-bandit");

  const progressOf = (tt: TennisTable, playerId: string) =>
    tt.achievements.getPlayerProgression(playerId)["bad-side-bandit"];

  const calculated = (events: EventType[]): TennisTable => {
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();
    return tt;
  };

  it("awards after 10 games won with more sets on the bad side, stamped at the 10th", () => {
    const tt = calculated([...baseEvents, ...games(10, "alice", "bob", ["B", "G", "B"])]);

    const awards = awardsOf(tt, "alice");
    expect(awards).toHaveLength(1);
    expect(awards[0].earnedAt).toBe(190);
    expect(awards[0].earnedByGame).toBe("g9");
  });

  it("does NOT award before the 10th game", () => {
    const tt = calculated([...baseEvents, ...games(9, "alice", "bob", ["B", "G", "B"])]);

    expect(awardsOf(tt, "alice")).toHaveLength(0);
    expect(progressOf(tt, "alice").current).toBe(9);
  });

  it("does NOT count a game with equal sets on the bad side", () => {
    const tt = calculated([...baseEvents, ...games(10, "alice", "bob", ["B", "G", "N"])]);

    expect(awardsOf(tt, "alice")).toHaveLength(0);
    expect(progressOf(tt, "alice").current).toBe(0);
  });

  it("does NOT count a game where the opponent had more sets on the bad side", () => {
    const tt = calculated([...baseEvents, ...games(10, "alice", "bob", ["G", "G", "B"])]);

    expect(progressOf(tt, "alice").current).toBe(0);
    // Bob had more sets on the bad side, but he lost, so he gets nothing.
    expect(progressOf(tt, "bob").current).toBe(0);
  });

  it("counts only the sets with a recorded bad side", () => {
    // 1 set on the bad side against 0: "N" and unrecorded sets count for nobody.
    const tt = calculated([...baseEvents, ...games(10, "alice", "bob", ["B", "N", null])]);

    expect(awardsOf(tt, "alice")).toHaveLength(1);
  });

  it("does NOT count a game without recorded sides", () => {
    const tt = calculated([...baseEvents, ...games(10, "alice", "bob")]);

    expect(progressOf(tt, "alice").current).toBe(0);
  });

  it("counts games against different opponents", () => {
    const tt = calculated([
      ...baseEvents,
      ...Array.from({ length: 10 }, (_, i) =>
        game(`g${i}`, 100 + i * 10, "alice", i % 2 === 0 ? "bob" : "chris", ["B", "B"]),
      ).flat(),
    ]);

    expect(awardsOf(tt, "alice")).toHaveLength(1);
  });

  it("is awarded only once, and progression caps at the target", () => {
    const tt = calculated([...baseEvents, ...games(12, "alice", "bob", ["B", "B"])]);

    expect(awardsOf(tt, "alice")).toHaveLength(1);
    const progression = progressOf(tt, "alice");
    expect(progression.current).toBe(10);
    expect(progression.target).toBe(10);
    expect(progression.earned).toBe(1);
  });
});
