import { Achievement } from "../../achievements";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Games are played one minute apart, in the order they are listed.
const GAME_INTERVAL = 60 * 1000;
const FIRST_GAME_AT = 1_000_000;

function playedAt(index: number): number {
  return FIRST_GAME_AT + index * GAME_INTERVAL;
}

/** Builds the event log for a list of games given as [winner, loser] pairs. */
function eventsForGames(games: [winner: string, loser: string][]): EventType[] {
  const players = Array.from(new Set(games.flat()));
  return [
    ...players.map<EventType>((player, index) => ({
      type: EventTypeEnum.PLAYER_CREATED,
      stream: player,
      time: index + 1,
      data: { name: player },
    })),
    ...games.map<EventType>(([winner, loser], index) => ({
      type: EventTypeEnum.GAME_CREATED,
      stream: `g${index}`,
      time: playedAt(index),
      data: { winner, loser, playedAt: playedAt(index) },
    })),
  ];
}

function achievementsOfType<T extends "longest-win-streak" | "longest-lose-streak">(
  tt: TennisTable,
  player: string,
  type: T,
): Extract<Achievement, { type: T }>[] {
  return tt.achievements
    .getAchievements(player)
    .filter((achievement): achievement is Extract<Achievement, { type: T }> => achievement.type === type);
}

function calculate(games: [winner: string, loser: string][]): TennisTable {
  const tt = new TennisTable({ events: eventsForGames(games) });
  tt.achievements.calculateAchievements();
  return tt;
}

/** `count` wins for `winner`, cycling through the given opponents. */
function wins(winner: string, opponents: string[], count: number): [string, string][] {
  return Array.from({ length: count }, (_, index) => [winner, opponents[index % opponents.length]]);
}

/** `count` losses for `loser`, cycling through the given opponents. */
function losses(loser: string, opponents: string[], count: number): [string, string][] {
  return Array.from({ length: count }, (_, index) => [opponents[index % opponents.length], loser]);
}

describe("Longest Win Streak / Longest Lose Streak achievements", () => {
  it("does not award a streak shorter than the 3 game floor", () => {
    const tt = calculate([
      ["alice", "bob"],
      ["alice", "carol"],
    ]);

    expect(achievementsOfType(tt, "alice", "longest-win-streak")).toHaveLength(0);
    expect(tt.achievements.winStreakRecord).toStrictEqual({ length: undefined, holder: undefined });
  });

  it("awards the first streak to reach the floor, with no previous record", () => {
    const tt = calculate(wins("alice", ["bob", "carol"], 3));

    const awards = achievementsOfType(tt, "alice", "longest-win-streak");
    expect(awards).toHaveLength(1);
    expect(awards[0]).toStrictEqual({
      type: "longest-win-streak",
      earnedBy: "alice",
      earnedAt: playedAt(2),
      earnedByGame: "g2",
      data: { streakLength: 3, startedAt: playedAt(0), previousRecord: undefined },
    });
    expect(tt.achievements.winStreakRecord).toStrictEqual({ length: 3, holder: "alice" });
  });

  it("grows the award instead of handing out another one while the same streak keeps the record", () => {
    const tt = calculate(wins("alice", ["bob", "carol"], 6));

    const awards = achievementsOfType(tt, "alice", "longest-win-streak");
    expect(awards).toHaveLength(1);
    expect(awards[0].data).toStrictEqual({
      streakLength: 6,
      startedAt: playedAt(0),
      previousRecord: undefined,
    });
    // earnedAt follows the streak, so the award spans the whole record run.
    expect(awards[0].earnedAt).toBe(playedAt(5));
    expect(tt.achievements.winStreakRecord).toStrictEqual({ length: 6, holder: "alice" });
  });

  it("awards a second time when a new streak beats the player's own record", () => {
    const tt = calculate([
      // Alice takes the record with 4 in a row.
      ...wins("alice", ["bob", "carol"], 4),
      // The streak is broken, so the next run is a different streak.
      ["bob", "alice"],
      ...wins("alice", ["bob", "carol"], 5),
    ]);

    const awards = achievementsOfType(tt, "alice", "longest-win-streak");
    expect(awards).toHaveLength(2);
    expect(awards[0].data).toStrictEqual({
      streakLength: 4,
      startedAt: playedAt(0),
      previousRecord: undefined,
    });
    expect(awards[1].data).toStrictEqual({
      streakLength: 5,
      startedAt: playedAt(5),
      previousRecord: 4,
    });
    expect(tt.achievements.winStreakRecord).toStrictEqual({ length: 5, holder: "alice" });
  });

  it("awards the same streak a second time when another player took the record in the meantime", () => {
    const tt = calculate([
      // Alice takes the record with 10 in a row, and stops there for now.
      ...wins("alice", ["bob", "carol"], 10),
      // Dave beats it with 11 while Alice's streak is still alive.
      ...wins("dave", ["bob", "carol"], 11),
      // Alice wins 2 more — 11 ties Dave and does not award, 12 takes the
      // record back and, because Dave broke it in between, earns again.
      ...wins("alice", ["bob", "carol"], 2),
    ]);

    const aliceAwards = achievementsOfType(tt, "alice", "longest-win-streak");
    expect(aliceAwards).toHaveLength(2);
    // The first award keeps the length it had while it was the record.
    expect(aliceAwards[0].data).toStrictEqual({
      streakLength: 10,
      startedAt: playedAt(0),
      previousRecord: undefined,
    });
    expect(aliceAwards[0].earnedAt).toBe(playedAt(9));
    // The second covers the same streak, now 12 long.
    expect(aliceAwards[1].data).toStrictEqual({
      streakLength: 12,
      startedAt: playedAt(0),
      previousRecord: 11,
    });
    expect(aliceAwards[1].earnedAt).toBe(playedAt(22));

    expect(achievementsOfType(tt, "dave", "longest-win-streak")).toHaveLength(1);
    expect(tt.achievements.winStreakRecord).toStrictEqual({ length: 12, holder: "alice" });
  });

  it("does not award for tying the record", () => {
    const tt = calculate([...wins("alice", ["bob", "carol"], 5), ...wins("dave", ["bob", "carol"], 5)]);

    expect(achievementsOfType(tt, "alice", "longest-win-streak")).toHaveLength(1);
    expect(achievementsOfType(tt, "dave", "longest-win-streak")).toHaveLength(0);
    expect(tt.achievements.winStreakRecord).toStrictEqual({ length: 5, holder: "alice" });
  });

  it("keeps growing the award after a rival tried and failed to beat it", () => {
    const tt = calculate([
      ...wins("alice", ["bob", "carol"], 5),
      // Dave gets to 4 — short of the record, so Alice still holds it.
      ...wins("dave", ["bob", "carol"], 4),
      ["bob", "dave"],
      // Alice extends the same streak: still one award, now 7 long.
      ...wins("alice", ["bob", "carol"], 2),
    ]);

    const awards = achievementsOfType(tt, "alice", "longest-win-streak");
    expect(awards).toHaveLength(1);
    expect(awards[0].data.streakLength).toBe(7);
    expect(achievementsOfType(tt, "dave", "longest-win-streak")).toHaveLength(0);
    expect(tt.achievements.winStreakRecord).toStrictEqual({ length: 7, holder: "alice" });
  });

  it("tracks the lose streak record the same way", () => {
    const tt = calculate([
      // Alice loses 4 in a row and takes the lose streak record.
      ...losses("alice", ["bob", "carol"], 4),
      // Dave loses 5 and takes it over.
      ...losses("dave", ["bob", "carol"], 5),
      // Alice loses 2 more, reaching 6, and earns again.
      ...losses("alice", ["bob", "carol"], 2),
    ]);

    const aliceAwards = achievementsOfType(tt, "alice", "longest-lose-streak");
    expect(aliceAwards).toHaveLength(2);
    expect(aliceAwards[0].data).toStrictEqual({
      streakLength: 4,
      startedAt: playedAt(0),
      previousRecord: undefined,
    });
    expect(aliceAwards[1].data).toStrictEqual({
      streakLength: 6,
      startedAt: playedAt(0),
      previousRecord: 5,
    });

    const daveAwards = achievementsOfType(tt, "dave", "longest-lose-streak");
    expect(daveAwards).toHaveLength(1);
    expect(daveAwards[0].data).toStrictEqual({
      streakLength: 5,
      startedAt: playedAt(4),
      previousRecord: 4,
    });

    expect(tt.achievements.loseStreakRecord).toStrictEqual({ length: 6, holder: "alice" });
    // The two records are tracked apart: Alice never won a game here, so she
    // holds the lose streak record and no win streak award at all.
    expect(achievementsOfType(tt, "alice", "longest-win-streak")).toHaveLength(0);
  });

  it("starts a new lose streak once a win breaks the old one", () => {
    const tt = calculate([
      ...losses("alice", ["bob", "carol"], 4),
      ["alice", "bob"],
      ...losses("alice", ["bob", "carol"], 5),
    ]);

    const awards = achievementsOfType(tt, "alice", "longest-lose-streak");
    expect(awards).toHaveLength(2);
    expect(awards[0].data).toStrictEqual({
      streakLength: 4,
      startedAt: playedAt(0),
      previousRecord: undefined,
    });
    expect(awards[1].data).toStrictEqual({
      streakLength: 5,
      startedAt: playedAt(5),
      previousRecord: 4,
    });
  });

  it("reports the live streak, personal best and league record in the progression", () => {
    const tt = calculate([
      // Alice takes the record with 5, then loses, then wins 2.
      ...wins("alice", ["bob", "carol"], 5),
      ["bob", "alice"],
      ...wins("alice", ["bob", "carol"], 2),
    ]);

    const aliceProgression = tt.achievements.getPlayerProgression("alice")["longest-win-streak"];
    expect(aliceProgression.current).toBe(2);
    expect(aliceProgression.best).toBe(5);
    // The record is 5, so a streak of 6 is what takes it.
    expect(aliceProgression.target).toBe(6);
    expect(aliceProgression.recordHolder).toBe("alice");
    expect(aliceProgression.earned).toBe(1);

    const bobProgression = tt.achievements.getPlayerProgression("bob")["longest-win-streak"];
    expect(bobProgression.current).toBe(0);
    expect(bobProgression.best).toBe(1);
    expect(bobProgression.target).toBe(6);
    expect(bobProgression.recordHolder).toBe("alice");
    expect(bobProgression.earned).toBe(0);
  });

  it("leaves the progression target unset until someone holds the record", () => {
    const tt = calculate([
      ["alice", "bob"],
      ["alice", "carol"],
    ]);

    const progression = tt.achievements.getPlayerProgression("alice");
    expect(progression["longest-win-streak"].target).toBeUndefined();
    expect(progression["longest-win-streak"].recordHolder).toBeUndefined();
    expect(progression["longest-win-streak"].current).toBe(2);
    expect(progression["longest-win-streak"].best).toBe(2);
    expect(progression["longest-lose-streak"].target).toBeUndefined();
    expect(progression["longest-lose-streak"].current).toBe(0);
    expect(progression["longest-lose-streak"].best).toBe(0);
  });
});
