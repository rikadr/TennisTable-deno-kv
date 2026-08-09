import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";
import { determineSeason } from "../../seasons/seasons";

// Full Coverage is awarded when a season ends, to every player who recorded
// a matchup against every other participant of that season. It requires
// FULL_COVERAGE_MIN_PLAYERS (5) or more participants.
describe("Full Coverage Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "dave", time: 4, data: { name: "Dave" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "erin", time: 5, data: { name: "Erin" } },
  ];

  const game = (id: string, playedAt: number, winner: string, loser: string): EventType => ({
    type: EventTypeEnum.GAME_CREATED,
    stream: id,
    time: playedAt,
    data: { winner, loser, playedAt },
  });

  // Mid-January 2024: safely inside the long-finished Q1 2024 season.
  const q1 = determineSeason(new Date(2024, 0, 10, 12).getTime());
  const t = (day: number) => new Date(2024, 0, day, 12).getTime();

  const coverageOf = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "full-coverage");

  it("awards every player who played all other participants — win or lose", () => {
    // Alice and Bob each play all 4 other participants; Carol, Dave and
    // Erin do not.
    const events: EventType[] = [
      ...baseEvents,
      game("g1", t(8), "alice", "bob"),
      game("g2", t(9), "alice", "carol"),
      game("g3", t(10), "dave", "alice"),
      game("g4", t(11), "erin", "alice"),
      game("g5", t(12), "bob", "carol"),
      game("g6", t(13), "bob", "dave"),
      game("g7", t(14), "erin", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = coverageOf(tt, "alice");
    expect(alice).toHaveLength(1);
    expect(alice[0]).toStrictEqual({
      type: "full-coverage",
      earnedBy: "alice",
      earnedAt: q1.end,
      data: { seasonStart: q1.start, opponentCount: 4 },
    });
    expect(coverageOf(tt, "bob")).toHaveLength(1);

    expect(coverageOf(tt, "carol")).toHaveLength(0);
    expect(coverageOf(tt, "dave")).toHaveLength(0);
    expect(coverageOf(tt, "erin")).toHaveLength(0);
  });

  it("is not awarded in a season with fewer than 5 participants", () => {
    // Four participants who all play each other — a complete round-robin,
    // but below the participant gate.
    const events: EventType[] = [
      ...baseEvents,
      game("g1", t(8), "alice", "bob"),
      game("g2", t(9), "alice", "carol"),
      game("g3", t(10), "alice", "dave"),
      game("g4", t(11), "bob", "carol"),
      game("g5", t(12), "bob", "dave"),
      game("g6", t(13), "carol", "dave"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    for (const player of ["alice", "bob", "carol", "dave"]) {
      expect(coverageOf(tt, player)).toHaveLength(0);
    }
  });

  it("is not awarded while the season is still running", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2024, 1, 1, 12).getTime()); // inside the Q1 2024 season

    const events: EventType[] = [
      ...baseEvents,
      game("g1", t(8), "alice", "bob"),
      game("g2", t(9), "alice", "carol"),
      game("g3", t(10), "dave", "alice"),
      game("g4", t(11), "erin", "alice"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(coverageOf(tt, "alice")).toHaveLength(0);

    jest.useRealTimers();
  });

  describe("progress towards the live season's participants", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("counts matchups against participants and lists who is still to play", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 1, 1, 12).getTime()); // inside the Q1 2024 season

      // Participants so far: alice, bob, carol, dave. Erin has not played.
      const events: EventType[] = [
        ...baseEvents,
        game("g1", t(8), "alice", "bob"),
        game("g2", t(9), "alice", "carol"),
        game("g3", t(10), "bob", "dave"),
      ];

      const tt = new TennisTable({ events });
      tt.achievements.calculateAchievements();

      const alice = tt.achievements.getPlayerProgression("alice")["full-coverage"];
      expect(alice.current).toBe(2);
      expect(alice.target).toBe(3);
      expect(alice.missing).toStrictEqual(new Set(["dave"]));
      expect(alice.earned).toBe(0);

      // A player outside the season still needs everyone who has played.
      const erin = tt.achievements.getPlayerProgression("erin")["full-coverage"];
      expect(erin.current).toBe(0);
      expect(erin.target).toBe(4);
      expect(erin.missing).toStrictEqual(new Set(["alice", "bob", "carol", "dave"]));
    });
  });
});
