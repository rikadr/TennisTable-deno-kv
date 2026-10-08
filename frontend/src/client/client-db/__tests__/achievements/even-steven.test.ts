import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Even Steven: as many wins as losses against one opponent, after 20 or more
// games together. Both players earn it. One-time achievement.

describe("Even Steven Achievement", () => {
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

  // Alice and Bob take turns to win, Alice first.
  const alternatingGames = (count: number, startTime = 100): EventType[] =>
    Array.from({ length: count }, (_, i) =>
      game(`g${startTime + i}`, startTime + i, i % 2 === 0 ? "alice" : "bob", i % 2 === 0 ? "bob" : "alice"),
    );

  const evenStevenAwards = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "even-steven");

  it("awards both players at the 20th game when the head to head is equal", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...alternatingGames(20)] });
    tt.achievements.calculateAchievements();

    for (const [playerId, opponent] of [
      ["alice", "bob"],
      ["bob", "alice"],
    ]) {
      const awards = evenStevenAwards(tt, playerId);
      expect(awards).toHaveLength(1);
      expect(awards[0].earnedAt).toBe(119);
      expect(awards[0].earnedByGame).toBe("g119");
      expect(awards[0].data).toEqual({ gameId: "g119", opponent, gamesPlayed: 20 });
    }
  });

  it("does not award an equal head to head before 20 games", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...alternatingGames(18)] });
    tt.achievements.calculateAchievements();

    expect(evenStevenAwards(tt, "alice")).toHaveLength(0);
    expect(evenStevenAwards(tt, "bob")).toHaveLength(0);
  });

  it("awards only once", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...alternatingGames(40)] });
    tt.achievements.calculateAchievements();

    expect(evenStevenAwards(tt, "alice")).toHaveLength(1);
    expect(evenStevenAwards(tt, "bob")).toHaveLength(1);
  });

  it("awards when the head to head becomes equal after 20 games", () => {
    // Alice wins 12 and Bob wins 8. Then Bob wins 4 in a row.
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 20; i++)
      events.push(game(`a${i}`, 100 + i, i < 12 ? "alice" : "bob", i < 12 ? "bob" : "alice"));
    for (let i = 0; i < 4; i++) events.push(game(`b${i}`, 200 + i, "bob", "alice"));
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(evenStevenAwards(tt, "bob")).toHaveLength(1);
    expect(evenStevenAwards(tt, "bob")[0].earnedAt).toBe(203);
  });

  it("measures the progress from the opponent closest to equal", () => {
    // Alice against Bob: 14 wins and 6 losses, 8 games from equal.
    // Alice against Carol: 12 wins and 9 losses, 3 games from equal.
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 20; i++)
      events.push(game(`b${i}`, 100 + i, i < 14 ? "alice" : "bob", i < 14 ? "bob" : "alice"));
    for (let i = 0; i < 21; i++)
      events.push(game(`c${i}`, 200 + i, i < 12 ? "alice" : "carol", i < 12 ? "carol" : "alice"));
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const progression = tt.achievements.getPlayerProgression("alice")["even-steven"];
    expect(progression.closestOpponent).toBe("carol");
    expect(progression.gamesFromEven).toBe(3);
    expect(progression.current).toBe(17);
    expect(progression.target).toBe(20);
  });

  it("ignores opponents with fewer than 20 games together", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...alternatingGames(19)] });
    tt.achievements.calculateAchievements();

    const progression = tt.achievements.getPlayerProgression("alice")["even-steven"];
    expect(progression.current).toBe(0);
    expect(progression.closestOpponent).toBeUndefined();
  });

  it("ignores a retired opponent in the progress", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 21; i++)
      events.push(game(`g${i}`, 100 + i, i < 11 ? "alice" : "bob", i < 11 ? "bob" : "alice"));
    events.push({ type: EventTypeEnum.PLAYER_DEACTIVATED, stream: "bob", time: 500, data: null });
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const progression = tt.achievements.getPlayerProgression("alice")["even-steven"];
    expect(progression.current).toBe(0);
    expect(progression.closestOpponent).toBeUndefined();
  });

  it("caps the progress at 0 when the head to head is 20 or more games from equal", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 20; i++) events.push(game(`g${i}`, 100 + i, "alice", "bob"));
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const progression = tt.achievements.getPlayerProgression("bob")["even-steven"];
    expect(progression.gamesFromEven).toBe(20);
    expect(progression.current).toBe(0);
  });
});
