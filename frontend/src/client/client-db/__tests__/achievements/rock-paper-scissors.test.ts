import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Rock Paper Scissors: in one local day, A beats B, B beats C and C beats A.
// All 3 players earn it at the game that completes the cycle, 1 time for each
// cycle.

describe("Rock Paper Scissors Achievement", () => {
  const baseEvents: EventType[] = ["alice", "bob", "chris", "dana"].map((id, i) => ({
    type: EventTypeEnum.PLAYER_CREATED,
    stream: id,
    time: i + 1,
    data: { name: id },
  }));

  const gameAt = (day: number, hour: number, winner: string, loser: string): EventType => {
    const playedAt = new Date(2024, 0, day, hour).getTime();
    return {
      type: EventTypeEnum.GAME_CREATED,
      stream: `g-${day}-${hour}`,
      time: playedAt,
      data: { playedAt, winner, loser },
    };
  };

  const awards = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "rock-paper-scissors");

  it("awards all 3 players at the game that completes the cycle", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        gameAt(15, 9, "alice", "bob"),
        gameAt(15, 10, "bob", "chris"),
        gameAt(15, 11, "chris", "alice"),
      ],
    });
    tt.achievements.calculateAchievements();

    const day = new Date(2024, 0, 15).getTime();
    const alice = awards(tt, "alice");
    expect(alice).toHaveLength(1);
    expect(alice[0].earnedByGame).toBe("g-15-11");
    expect(alice[0].earnedAt).toBe(new Date(2024, 0, 15, 11).getTime());
    expect(alice[0].data).toEqual({ day, beat: "bob", lostTo: "chris" });
    expect(awards(tt, "bob")[0].data).toEqual({ day, beat: "chris", lostTo: "alice" });
    expect(awards(tt, "chris")[0].data).toEqual({ day, beat: "alice", lostTo: "bob" });
    expect(awards(tt, "dana")).toHaveLength(0);
  });

  it("does NOT award a chain that is not a cycle", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        gameAt(15, 9, "alice", "bob"),
        gameAt(15, 10, "bob", "chris"),
        gameAt(15, 11, "alice", "chris"),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(awards(tt, "alice")).toHaveLength(0);
  });

  it("does NOT award a cycle spread over 2 days", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        gameAt(15, 9, "alice", "bob"),
        gameAt(15, 10, "bob", "chris"),
        gameAt(16, 9, "chris", "alice"),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(awards(tt, "alice")).toHaveLength(0);
  });

  it("awards every cycle of a day, so a player can earn it more than 1 time in a day", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        gameAt(15, 9, "alice", "bob"),
        gameAt(15, 10, "bob", "chris"),
        gameAt(15, 11, "chris", "alice"),
        // A second cycle the same day: alice, bob and dana.
        gameAt(15, 12, "bob", "dana"),
        gameAt(15, 13, "dana", "alice"),
      ],
    });
    tt.achievements.calculateAchievements();

    const day = new Date(2024, 0, 15).getTime();
    expect(awards(tt, "alice").map((a) => [a.earnedByGame, a.data])).toEqual([
      ["g-15-11", { day, beat: "bob", lostTo: "chris" }],
      ["g-15-13", { day, beat: "bob", lostTo: "dana" }],
    ]);
    expect(awards(tt, "bob")).toHaveLength(2);
    expect(awards(tt, "chris")).toHaveLength(1);
    expect(awards(tt, "dana")).toHaveLength(1);
    expect(tt.achievements.getPlayerProgression("alice")["rock-paper-scissors"].earned).toBe(2);
  });

  it("awards each cycle that one game completes", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        gameAt(15, 9, "bob", "chris"),
        gameAt(15, 10, "bob", "dana"),
        gameAt(15, 11, "chris", "alice"),
        gameAt(15, 12, "dana", "alice"),
        // Completes alice-bob-chris and alice-bob-dana.
        gameAt(15, 13, "alice", "bob"),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(awards(tt, "alice").map((a) => a.earnedByGame)).toEqual(["g-15-13", "g-15-13"]);
    expect(awards(tt, "alice").map((a) => a.data.lostTo)).toEqual(["chris", "dana"]);
    expect(awards(tt, "bob")).toHaveLength(2);
    expect(awards(tt, "chris")).toHaveLength(1);
    expect(awards(tt, "dana")).toHaveLength(1);
  });

  it("does NOT award a cycle again when one of its wins is repeated", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        gameAt(15, 9, "alice", "bob"),
        gameAt(15, 10, "bob", "chris"),
        gameAt(15, 11, "chris", "alice"),
        gameAt(15, 12, "alice", "bob"),
        gameAt(17, 9, "alice", "bob"),
        gameAt(17, 10, "bob", "chris"),
        gameAt(17, 11, "chris", "alice"),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(awards(tt, "alice").map((a) => a.earnedByGame)).toEqual(["g-15-11", "g-17-11"]);
  });
});
