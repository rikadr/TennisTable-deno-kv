import { RECORD_GRACE_PERIOD_DAYS } from "../../achievements";
import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// The "earliest-game" / "latest-game" achievements are league-wide,
// record-breaking achievements. A game that sets a new earliest / latest
// time-of-day (in the browser's local timezone) awards the achievement to
// BOTH players. The very first game only seeds the records — there is no
// prior record to break — so it awards neither. Games in the grace period
// after the league's first game only move the records.
//
// Timestamps are built with `new Date(y, m, d, h, min)` so they are created
// and read back in the same local timezone, keeping the test deterministic
// regardless of the machine's TZ. Games are chronologically increasing (by
// day) while their time-of-day varies to trigger records. The test days are
// more than the grace period apart, so only the day-1 game is in it.

describe("Earliest / Latest Game Achievements", () => {
  // Local-time timestamp for a given test day and time-of-day.
  const at = (day: number, hour: number, minute: number): number =>
    new Date(2024, 0, 1 + (day - 1) * (RECORD_GRACE_PERIOD_DAYS + 1), hour, minute).getTime();

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

  const earliest = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "earliest-game");
  const latest = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "latest-game");

  it("does not award anything on the very first game (only seeds the records)", () => {
    const events: EventType[] = [...players(), game("g1", at(1, 12, 0), "alice", "bob")];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(earliest(tt, "alice")).toHaveLength(0);
    expect(earliest(tt, "bob")).toHaveLength(0);
    expect(latest(tt, "alice")).toHaveLength(0);
    expect(latest(tt, "bob")).toHaveLength(0);
  });

  it("awards earliest-game to both players when the earliest record is broken", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", at(1, 12, 0), "alice", "bob"), // seeds records
      game("g2", at(2, 9, 30), "alice", "bob"), // 09:30 < 12:00 -> new earliest
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceEarliest = earliest(tt, "alice");
    expect(aliceEarliest).toHaveLength(1);
    expect(aliceEarliest[0].earnedAt).toBe(at(2, 9, 30));
    expect(aliceEarliest[0].data).toEqual({
      gameId: "g2",
      opponent: "bob",
      time: "09:30",
      minutesIntoDay: 9 * 60 + 30,
    });

    const bobEarliest = earliest(tt, "bob");
    expect(bobEarliest).toHaveLength(1);
    expect(bobEarliest[0].data).toEqual({
      gameId: "g2",
      opponent: "alice",
      time: "09:30",
      minutesIntoDay: 9 * 60 + 30,
    });

    // No latest-game awarded — the record was only beaten on the early side.
    expect(latest(tt, "alice")).toHaveLength(0);
  });

  it("awards latest-game to both players when the latest record is broken", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", at(1, 12, 0), "alice", "bob"), // seeds records
      game("g2", at(2, 22, 5), "bob", "alice"), // 22:05 > 12:00 -> new latest
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceLatest = latest(tt, "alice");
    expect(aliceLatest).toHaveLength(1);
    expect(aliceLatest[0].earnedAt).toBe(at(2, 22, 5));
    expect(aliceLatest[0].data).toEqual({
      gameId: "g2",
      opponent: "bob",
      time: "22:05",
      minutesIntoDay: 22 * 60 + 5,
    });
    expect(latest(tt, "bob")).toHaveLength(1);
    expect(earliest(tt, "alice")).toHaveLength(0);
  });

  it("does not award for games that break neither record", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", at(1, 9, 0), "alice", "bob"), // seeds: earliest=latest=09:00
      game("g2", at(2, 18, 0), "alice", "bob"), // new latest
      game("g3", at(3, 12, 0), "alice", "bob"), // between 09:00 and 18:00 -> nothing
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    // Only the one latest-game from g2.
    expect(latest(tt, "alice")).toHaveLength(1);
    expect(latest(tt, "alice")[0].data.gameId).toBe("g2");
    expect(earliest(tt, "alice")).toHaveLength(0);
  });

  it("only moves the records in the grace period, and awards a later game that reaches them", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", new Date(2024, 0, 1, 12, 0).getTime(), "alice", "bob"), // seeds 12:00
      game("g2", new Date(2024, 0, 3, 9, 0).getTime(), "alice", "bob"), // in the grace period: earliest -> 09:00
      game("g3", new Date(2024, 0, 3, 20, 0).getTime(), "alice", "bob"), // in the grace period: latest -> 20:00
      game("g4", at(2, 9, 0), "alice", "bob"), // after it: ties 09:00 -> earliest
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(earliest(tt, "alice").map((a) => a.data.gameId)).toEqual(["g4"]);
    expect(latest(tt, "alice")).toHaveLength(0);
    expect(tt.achievements.earliestGameRecord.minutesIntoDay).toBe(9 * 60);
    expect(tt.achievements.latestGameRecord.minutesIntoDay).toBe(20 * 60);
  });

  it("awards on a tie with the current record", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", at(1, 10, 0), "alice", "bob"), // seeds 10:00
      game("g2", at(2, 10, 0), "alice", "bob"), // equal earliest & equal latest -> both
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(earliest(tt, "alice").map((a) => a.data.gameId)).toEqual(["g2"]);
    expect(latest(tt, "alice").map((a) => a.data.gameId)).toEqual(["g2"]);
    expect(earliest(tt, "bob")).toHaveLength(1);
    expect(latest(tt, "bob")).toHaveLength(1);
  });

  it("awards again each time a record is broken further", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", at(1, 12, 0), "alice", "bob"), // seeds
      game("g2", at(2, 8, 0), "alice", "bob"), // earliest -> 08:00
      game("g3", at(3, 6, 30), "alice", "bob"), // earliest -> 06:30
      game("g4", at(4, 0, 0), "alice", "bob"), // earliest -> 00:00 (earliest possible)
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceEarliest = earliest(tt, "alice");
    expect(aliceEarliest).toHaveLength(3);
    expect(aliceEarliest.map((a) => a.data.time)).toEqual(["08:00", "06:30", "00:00"]);

    const bobEarliest = earliest(tt, "bob");
    expect(bobEarliest).toHaveLength(3);
  });

  it("exposes progression with the league record and the player's own best (no target/bar)", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", at(1, 12, 0), "alice", "bob"), // seeds record at 12:00
      game("g2", at(2, 9, 0), "alice", "bob"), // earliest -> 09:00
      game("g3", at(3, 20, 30), "alice", "bob"), // latest -> 20:30
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getPlayerProgression("alice");

    // Present in the progression map so they render in the progress list.
    expect("earliest-game" in alice).toBe(true);
    expect("latest-game" in alice).toBe(true);

    // No numeric progress bar — these have no target.
    expect("target" in alice["earliest-game"]).toBe(false);
    expect("target" in alice["latest-game"]).toBe(false);

    // League record + the player's own best (minutes past local midnight).
    expect(alice["earliest-game"].recordMinutes).toBe(9 * 60);
    expect(alice["earliest-game"].playerMinutes).toBe(9 * 60);
    expect(alice["latest-game"].recordMinutes).toBe(20 * 60 + 30);
    expect(alice["latest-game"].playerMinutes).toBe(20 * 60 + 30);

    // earned counts the times the record was broken.
    expect(alice["earliest-game"].earned).toBe(1);
    expect(alice["latest-game"].earned).toBe(1);
  });

  it("reports a player's own best independent of the league record", () => {
    // Carol only plays a midday game; the league records are set by others.
    const events: EventType[] = [
      ...players(),
      { time: 3, stream: "carol", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Carol" } },
      game("g1", at(1, 6, 0), "alice", "bob"), // seeds league record 06:00
      game("g2", at(2, 23, 0), "alice", "bob"), // league latest -> 23:00
      game("g3", at(3, 13, 0), "carol", "alice"), // carol's only game, 13:00
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const carol = tt.achievements.getPlayerProgression("carol");
    expect(carol["earliest-game"].recordMinutes).toBe(6 * 60);
    expect(carol["earliest-game"].playerMinutes).toBe(13 * 60);
    expect(carol["latest-game"].recordMinutes).toBe(23 * 60);
    expect(carol["latest-game"].playerMinutes).toBe(13 * 60);
    // Carol never broke a record.
    expect(carol["earliest-game"].earned).toBe(0);
    expect(carol["latest-game"].earned).toBe(0);
  });
});
