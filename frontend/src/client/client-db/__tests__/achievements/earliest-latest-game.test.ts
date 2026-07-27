import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// The "earliest-game" / "latest-game" achievements are league-wide,
// record-breaking achievements. A game that sets a new earliest / latest
// time-of-day (in the browser's local timezone) awards the achievement to
// BOTH players. The very first game only seeds the records — there is no
// prior record to break — so it awards neither.
//
// Timestamps are built with `new Date(y, m, d, h, min)` so they are created
// and read back in the same local timezone, keeping the test deterministic
// regardless of the machine's TZ. Games are chronologically increasing (by
// day) while their time-of-day varies to trigger records.

describe("Earliest / Latest Game Achievements", () => {
  // Local-time timestamp for a given day and time-of-day.
  const at = (day: number, hour: number, minute: number): number =>
    new Date(2024, 0, day, hour, minute).getTime();

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

  it("does not award on a tie with the current record (strictly break required)", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", at(1, 10, 0), "alice", "bob"), // seeds 10:00
      game("g2", at(2, 10, 0), "alice", "bob"), // equal earliest & equal latest -> nothing
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(earliest(tt, "alice")).toHaveLength(0);
    expect(latest(tt, "alice")).toHaveLength(0);
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

  it("does not create progression entries for these achievements", () => {
    const events: EventType[] = [
      ...players(),
      game("g1", at(1, 12, 0), "alice", "bob"),
      game("g2", at(2, 9, 0), "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const progression = tt.achievements.getPlayerProgression("alice");
    expect("earliest-game" in progression).toBe(false);
    expect("latest-game" in progression).toBe(false);
  });
});
