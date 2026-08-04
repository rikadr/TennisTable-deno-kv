import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { determineNextSeason, determineSeason } from "../../seasons/seasons";
import { achievementProgressPercentage } from "../../../../common/achievement-progress";

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

  // The progress is a league-wide countdown to the next season start: the same
  // values for every player, whether or not they ever opened a season.
  describe("progress towards the next Season Opener", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    const q1 = determineSeason(q1Game1);
    const q2Start = determineNextSeason(q1Game1).start;
    // A game in the Q4 2023 season, so a season exists before Q1 2024 starts.
    const q4Game = new Date(2023, 9, 10, 12).getTime();

    function progressionFor(events: EventType[], playerId: string) {
      const tt = new TennisTable({ events });
      tt.achievements.calculateAchievements();
      return tt.achievements.getPlayerProgression(playerId)["season-opener"];
    }

    function percentageOf(progress: { current: number; target: number }) {
      return achievementProgressPercentage("season-opener", progress.current, progress.target);
    }

    it("counts from the season start towards the next season start, the same for everyone", () => {
      const now = new Date(2024, 1, 1, 12).getTime(); // 1 February 2024, inside the Q1 season
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const events: EventType[] = [...baseEvents, game("g1", q1Game1, "alice", "bob")];

      // Alice opened the season and Carol has never played, but the countdown
      // is the same for both.
      for (const player of ["alice", "carol"]) {
        const progress = progressionFor(events, player);
        expect(progress.target).toBe(q2Start - q1.start);
        expect(progress.current).toBe(now - q1.start);
        expect(progress.nextSeasonStart).toBe(q2Start);
      }
      expect(progressionFor(events, "alice").earned).toBe(1);
      expect(progressionFor(events, "carol").earned).toBe(0);
    });

    it("starts at 0 at the season start", () => {
      jest.useFakeTimers();
      jest.setSystemTime(q1.start);

      const events: EventType[] = [...baseEvents, game("g1", q1.start, "alice", "bob")];

      expect(progressionFor(events, "alice").current).toBe(0);
    });

    it("holds at 100% while the season is open and has no games", () => {
      const now = new Date(2024, 0, 2, 12).getTime(); // the day after the Q1 season started
      jest.useFakeTimers();
      jest.setSystemTime(now);

      // The last game is in the Q4 2023 season, so the Q1 season is open and
      // its opener is still there to take.
      const events: EventType[] = [...baseEvents, game("g1", q4Game, "alice", "bob")];

      const progress = progressionFor(events, "carol");
      expect(progress.current).toBe(progress.target);
      expect(percentageOf(progress)).toBe(100);
    });

    it("falls back to the countdown once the opening game is played", () => {
      const now = new Date(2024, 0, 2, 12).getTime();
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const openingGame = new Date(2024, 0, 2, 10).getTime(); // two hours before now
      const events: EventType[] = [
        ...baseEvents,
        game("g1", q4Game, "alice", "bob"),
        game("g2", openingGame, "alice", "carol"),
      ];

      // The player who earned it and a player who did not are both back at the
      // same small part of the way towards the next season start.
      for (const player of ["alice", "dave"]) {
        const progress = progressionFor(events, player);
        expect(progress.target).toBe(q2Start - q1.start);
        expect(progress.current).toBe(now - q1.start);
        expect(percentageOf(progress)).toBeLessThan(5);
      }
    });

    it("keeps counting through the grace period between seasons", () => {
      const now = new Date(2024, 2, 25, 12).getTime(); // 25 March 2024, after the Q1 season ended
      jest.useFakeTimers();
      jest.setSystemTime(now);
      expect(now).toBeGreaterThan(q1.end);
      expect(now).toBeLessThan(q2Start);

      const events: EventType[] = [...baseEvents, game("g1", q1Game1, "alice", "bob")];

      // The countdown still measures from the Q1 season start, so the bar is
      // close to full but not yet at 100%.
      const progress = progressionFor(events, "carol");
      expect(progress.target).toBe(q2Start - q1.start);
      expect(progress.current).toBe(now - q1.start);
      expect(percentageOf(progress)).toBeGreaterThan(90);
      expect(percentageOf(progress)).toBeLessThan(100);
    });

    it("does not hold at 100% in the grace period after a season with no games", () => {
      const now = new Date(2024, 2, 25, 12).getTime();
      jest.useFakeTimers();
      jest.setSystemTime(now);

      // The Q1 season is over and nobody opened it, so its opener is gone.
      const events: EventType[] = [...baseEvents, game("g1", q4Game, "alice", "bob")];

      const progress = progressionFor(events, "carol");
      expect(progress.current).toBe(now - q1.start);
      expect(progress.current).toBeLessThan(progress.target);
    });
  });
});
