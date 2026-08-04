import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { determineSeason } from "../../seasons/seasons";

// Season Opener is awarded to BOTH players of a season's very first game,
// stamped at the game itself. Games in the grace period between seasons
// belong to no season and can never be an opener.
describe("Season Opener Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "dave", time: 4, data: { name: "Dave" } },
  ];

  const game = (id: string, playedAt: number, winner: string, loser: string): EventType => ({
    type: EventTypeEnum.GAME_CREATED,
    stream: id,
    time: playedAt,
    data: { winner, loser, playedAt },
  });

  // Mid-January 2024: safely inside the Q1 2024 season (starts the first
  // Monday of January at 08:00).
  const q1Game1 = new Date(2024, 0, 10, 12).getTime();
  const q1Game2 = new Date(2024, 0, 11, 12).getTime();
  // Mid-April 2024: safely inside the Q2 2024 season.
  const q2Game1 = new Date(2024, 3, 10, 12).getTime();

  it("awards BOTH players of the season's first game — and nobody else", () => {
    const events: EventType[] = [
      ...baseEvents,
      game("g1", q1Game1, "alice", "bob"),
      game("g2", q1Game2, "carol", "dave"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getAchievements("alice").filter((a) => a.type === "season-opener");
    const bob = tt.achievements.getAchievements("bob").filter((a) => a.type === "season-opener");
    expect(alice).toHaveLength(1);
    expect(bob).toHaveLength(1);
    expect(alice[0]).toStrictEqual({
      type: "season-opener",
      earnedBy: "alice",
      earnedAt: q1Game1,
      data: {
        seasonStart: determineSeason(q1Game1).start,
        gameId: "g1",
        opponent: "bob",
      },
    });
    expect(bob[0].data?.opponent).toBe("alice");

    expect(tt.achievements.getAchievements("carol").filter((a) => a.type === "season-opener")).toHaveLength(0);
    expect(tt.achievements.getAchievements("dave").filter((a) => a.type === "season-opener")).toHaveLength(0);
  });

  it("awards once per season — opening two seasons earns it twice", () => {
    const events: EventType[] = [
      ...baseEvents,
      game("g1", q1Game1, "alice", "bob"),
      game("g2", q2Game1, "alice", "carol"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getAchievements("alice").filter((a) => a.type === "season-opener");
    expect(alice).toHaveLength(2);
    expect(alice[0].data?.seasonStart).toBe(determineSeason(q1Game1).start);
    expect(alice[1].data?.seasonStart).toBe(determineSeason(q2Game1).start);
    expect(tt.achievements.getPlayerProgression("alice")["season-opener"].earned).toBe(2);
  });

  it("a grace-period game belongs to no season and is not an opener", () => {
    // The Q1 2024 season ends Friday Mar 22 17:00 (10 days before the Q2
    // season starts Monday Apr 1 08:00). A game between those moments sits
    // in the grace period.
    const q1 = determineSeason(q1Game1);
    const graceGame = q1.end + 60 * 60 * 1000; // one hour after the season ended
    expect(graceGame).toBeLessThan(determineSeason(q2Game1).start);

    const events: EventType[] = [
      ...baseEvents,
      game("g1", q1Game1, "alice", "bob"),
      game("g2", graceGame, "carol", "dave"),
      game("g3", q2Game1, "carol", "alice"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    // Carol's grace game earned nothing; her Q2 opener did.
    const carol = tt.achievements.getAchievements("carol").filter((a) => a.type === "season-opener");
    expect(carol).toHaveLength(1);
    expect(carol[0].data?.gameId).toBe("g3");
    expect(tt.achievements.getAchievements("dave").filter((a) => a.type === "season-opener")).toHaveLength(0);
  });
});
