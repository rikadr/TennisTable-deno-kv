import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";
import { ARCH_RIVALS_RECORD_FLOOR } from "../../achievements";

// Builds the table and calculates the achievements.
const table = (data: ConstructorParameters<typeof TennisTable>[0]): TennisTable => {
  const tt = new TennisTable(data);
  tt.achievements.calculateAchievements();
  return tt;
};

// Arch Rivals: the league record for the most games between one pair of
// players. Both players of the pair earn it.
describe("Arch Rivals Achievement", () => {
  const baseEvents: EventType[] = ["alice", "bob", "carol", "dave"].map((id, index) => ({
    type: EventTypeEnum.PLAYER_CREATED,
    stream: id,
    time: index + 1,
    data: { name: id },
  }));

  let time = 1000;
  const games = (count: number, winner: string, loser: string): EventType[] =>
    Array.from({ length: count }, () => {
      time += 1000;
      return {
        type: EventTypeEnum.GAME_CREATED,
        stream: `game-${time}`,
        time,
        data: { winner, loser, playedAt: time },
      } as EventType;
    });

  const awards = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "arch-rivals");

  beforeEach(() => {
    time = 1000;
  });

  it("awards both players when a pair reaches the floor, and grows the award with the record", () => {
    const events = [...baseEvents, ...games(ARCH_RIVALS_RECORD_FLOOR + 3, "alice", "bob")];
    const tt = table({ events });

    const alice = awards(tt, "alice");
    const bob = awards(tt, "bob");
    expect(alice).toHaveLength(1);
    expect(bob).toHaveLength(1);
    expect(alice[0].data).toMatchObject({
      opponent: "bob",
      gamesPlayed: ARCH_RIVALS_RECORD_FLOOR + 3,
      previousRecord: undefined,
    });
    expect(bob[0].data.opponent).toBe("alice");
    expect(tt.achievements.archRivalsRecord).toEqual({
      games: ARCH_RIVALS_RECORD_FLOOR + 3,
      holders: ["alice", "bob"],
    });
  });

  it("gives nothing below the floor", () => {
    const tt = table({ events: [...baseEvents, ...games(ARCH_RIVALS_RECORD_FLOOR - 1, "alice", "bob")] });
    expect(awards(tt, "alice")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("alice")["arch-rivals"]).toMatchObject({
      current: ARCH_RIVALS_RECORD_FLOOR - 1,
      topOpponent: "bob",
      target: undefined,
    });
  });

  it("awards a second pair that equals the record, and leaves the record with the first pair", () => {
    const events = [
      ...baseEvents,
      ...games(ARCH_RIVALS_RECORD_FLOOR + 2, "alice", "bob"),
      ...games(ARCH_RIVALS_RECORD_FLOOR + 2, "carol", "dave"),
    ];
    const tt = table({ events });

    expect(awards(tt, "carol")).toHaveLength(1);
    expect(awards(tt, "carol")[0].data).toMatchObject({
      opponent: "dave",
      gamesPlayed: ARCH_RIVALS_RECORD_FLOOR + 2,
      previousRecord: ARCH_RIVALS_RECORD_FLOOR + 2,
    });
    expect(tt.achievements.archRivalsRecord.holders).toEqual(["alice", "bob"]);

    // One more game moves the record to the second pair.
    const more = table({ events: [...events, ...games(1, "dave", "carol")] });
    expect(more.achievements.archRivalsRecord).toEqual({
      games: ARCH_RIVALS_RECORD_FLOOR + 3,
      holders: ["dave", "carol"],
    });
    expect(awards(more, "dave")).toHaveLength(1);
    expect(awards(more, "dave")[0].data.gamesPlayed).toBe(ARCH_RIVALS_RECORD_FLOOR + 3);
  });
});
