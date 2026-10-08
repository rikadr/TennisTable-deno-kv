import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Student Becomes Master: beat your first opponent after you lost your first
// game to them. One-time achievement.

describe("Student Becomes Master Achievement", () => {
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

  const awards = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "student-becomes-master");

  it("awards the first win against the opponent who won the first game", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        game("g1", 100, "alice", "bob"),
        game("g2", 110, "alice", "bob"),
        game("g3", 120, "bob", "carol"),
        game("g4", 130, "bob", "alice"),
      ],
    });
    tt.achievements.calculateAchievements();

    const bob = awards(tt, "bob");
    expect(bob).toHaveLength(1);
    expect(bob[0].earnedAt).toBe(130);
    expect(bob[0].earnedByGame).toBe("g4");
    expect(bob[0].data).toEqual({ gameId: "g4", opponent: "alice", gamesPlayed: 3 });
  });

  it("awards only once", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        game("g1", 100, "alice", "bob"),
        game("g2", 110, "bob", "alice"),
        game("g3", 120, "bob", "alice"),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(awards(tt, "bob")).toHaveLength(1);
  });

  it("does not award a player who won the first game", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        game("g1", 100, "alice", "bob"),
        game("g2", 110, "bob", "alice"),
        game("g3", 120, "alice", "bob"),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(awards(tt, "alice")).toHaveLength(0);
  });

  it("does not award a win against a different opponent", () => {
    const tt = new TennisTable({
      events: [...baseEvents, game("g1", 100, "alice", "bob"), game("g2", 110, "bob", "carol")],
    });
    tt.achievements.calculateAchievements();

    expect(awards(tt, "bob")).toHaveLength(0);
  });

  it("names the first opponent in the progress", () => {
    const tt = new TennisTable({ events: [...baseEvents, game("g1", 100, "alice", "bob")] });
    tt.achievements.calculateAchievements();

    const bob = tt.achievements.getPlayerProgression("bob")["student-becomes-master"];
    expect(bob.firstOpponent).toBe("alice");
    expect(bob.lostFirstGame).toBe(true);

    const alice = tt.achievements.getPlayerProgression("alice")["student-becomes-master"];
    expect(alice.firstOpponent).toBe("bob");
    expect(alice.lostFirstGame).toBe(false);
  });
});
