import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("TennisTable", () => {
  describe("Anniversary", () => {
    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const T0 = 1_500_000_000_000; // fixed base time for the player's first ever game (well in the past)

    const baseEvents = (): EventType[] => [
      { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
      { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    ];

    const game = (id: string, playedAt: number, winner = "alice", loser = "bob"): EventType => ({
      type: EventTypeEnum.GAME_CREATED,
      stream: id,
      time: playedAt,
      data: { winner, loser, playedAt },
    });

    function anniversariesFor(events: EventType[], playerId: string) {
      const tt = new TennisTable({ events });
      tt.achievements.calculateAchievements();
      return tt.achievements.getAchievements(playerId).filter((a) => a.type === "anniversary");
    }

    it("awards on the exact one-year anniversary, to both players in the game", () => {
      const events = [...baseEvents(), game("g0", T0), game("g1", T0 + ONE_YEAR)];

      for (const player of ["alice", "bob"]) {
        const earned = anniversariesFor(events, player);
        expect(earned).toHaveLength(1);
        expect(earned[0]).toStrictEqual({
          type: "anniversary",
          earnedBy: player,
          earnedAt: T0 + ONE_YEAR,
          data: { firstGameAt: T0, year: 1 },
        });
      }
    });

    it("awards when the game is one day before / after the anniversary", () => {
      for (const offset of [-ONE_DAY, ONE_DAY]) {
        const events = [...baseEvents(), game("g0", T0), game("g1", T0 + ONE_YEAR + offset)];
        const earned = anniversariesFor(events, "alice");
        expect(earned).toHaveLength(1);
        expect(earned[0].earnedAt).toBe(T0 + ONE_YEAR + offset);
        expect(earned[0].data).toStrictEqual({ firstGameAt: T0, year: 1 });
      }
    });

    it("does not award when the game is more than one day outside the window", () => {
      const events = [...baseEvents(), game("g0", T0), game("g1", T0 + ONE_YEAR + 2 * ONE_DAY)];
      expect(anniversariesFor(events, "alice")).toHaveLength(0);
    });

    it("does not award for games well short of one year", () => {
      const sixMonths = 6 * 30 * ONE_DAY;
      const events = [...baseEvents(), game("g0", T0), game("g1", T0 + sixMonths)];
      expect(anniversariesFor(events, "alice")).toHaveLength(0);
    });

    it("does not award off the very first game", () => {
      const events = [...baseEvents(), game("g0", T0)];
      expect(anniversariesFor(events, "alice")).toHaveLength(0);
    });

    it("awards only once per year even when multiple games fall inside one window", () => {
      const events = [
        ...baseEvents(),
        game("g0", T0),
        game("g1", T0 + ONE_YEAR - ONE_DAY),
        game("g2", T0 + ONE_YEAR),
        game("g3", T0 + ONE_YEAR + ONE_DAY),
      ];
      const earned = anniversariesFor(events, "alice");
      expect(earned).toHaveLength(1);
      expect(earned[0].earnedAt).toBe(T0 + ONE_YEAR - ONE_DAY); // first qualifying game
      expect(earned[0].data.year).toBe(1);
    });

    it("can be earned again on later yearly anniversaries", () => {
      const events = [
        ...baseEvents(),
        game("g0", T0),
        game("g1", T0 + ONE_YEAR),
        game("g2", T0 + 2 * ONE_YEAR),
        game("g3", T0 + 3 * ONE_YEAR),
      ];
      const earned = anniversariesFor(events, "alice").sort((a, b) => a.earnedAt - b.earnedAt);
      expect(earned.map((a) => a.type === "anniversary" && a.data.year)).toStrictEqual([1, 2, 3]);
      expect(earned.map((a) => a.earnedAt)).toStrictEqual([
        T0 + ONE_YEAR,
        T0 + 2 * ONE_YEAR,
        T0 + 3 * ONE_YEAR,
      ]);
    });

    it("skips a missed year but still awards a later one", () => {
      // Plays on year 1 and year 3, but not year 2.
      const events = [
        ...baseEvents(),
        game("g0", T0),
        game("g1", T0 + ONE_YEAR),
        game("g2", T0 + 3 * ONE_YEAR),
      ];
      const earned = anniversariesFor(events, "alice").sort((a, b) => a.earnedAt - b.earnedAt);
      expect(earned.map((a) => a.type === "anniversary" && a.data.year)).toStrictEqual([1, 3]);
    });

    it("uses each player's own first game as the anchor", () => {
      const bobFirst = T0 + 100 * ONE_DAY;
      const events: EventType[] = [
        { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
        { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 2, data: { name: "Carol" } },
        { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 3, data: { name: "Bob" } },
        game("g0", T0, "alice", "carol"),
        game("gBobDebut", bobFirst, "bob", "alice"),
        game("gAliceAnniv", T0 + ONE_YEAR, "alice", "bob"),
        game("gBobAnniv", bobFirst + ONE_YEAR, "bob", "alice"),
      ];

      expect(anniversariesFor(events, "alice")).toStrictEqual([
        { type: "anniversary", earnedBy: "alice", earnedAt: T0 + ONE_YEAR, data: { firstGameAt: T0, year: 1 } },
      ]);
      expect(anniversariesFor(events, "bob")).toStrictEqual([
        {
          type: "anniversary",
          earnedBy: "bob",
          earnedAt: bobFirst + ONE_YEAR,
          data: { firstGameAt: bobFirst, year: 1 },
        },
      ]);
    });

    // --- Progression --------------------------------------------------------

    function progressionFor(events: EventType[]) {
      const tt = new TennisTable({ events });
      tt.achievements.calculateAchievements();
      return tt.achievements.getPlayerProgression("alice").anniversary;
    }

    it("tracks progress toward the first anniversary (target = one year)", () => {
      const firstGame = Date.now() - 100 * ONE_DAY;
      const progression = progressionFor([...baseEvents(), game("g0", firstGame)]);

      expect(progression.earned).toBe(0);
      expect(progression.target).toBe(ONE_YEAR);
      expect(progression.current).toBeGreaterThan(99 * ONE_DAY);
      expect(progression.current).toBeLessThan(101 * ONE_DAY);
    });

    it("resets toward the next year once the window passes without earning", () => {
      // First game 1 year + 100 days ago; player never played in the window.
      const firstGame = Date.now() - (ONE_YEAR + 100 * ONE_DAY);
      const progression = progressionFor([...baseEvents(), game("g0", firstGame)]);

      expect(progression.earned).toBe(0);
      // Progress reset: counts ~100 days toward year 2, not ~465 days.
      expect(progression.current).toBeGreaterThan(99 * ONE_DAY);
      expect(progression.current).toBeLessThan(101 * ONE_DAY);
    });

    it("resets to ~0 immediately after earning a year", () => {
      // First game 1 year + 10 days ago; played a game in the year-1 window.
      const firstGame = Date.now() - (ONE_YEAR + 10 * ONE_DAY);
      const progression = progressionFor([
        ...baseEvents(),
        game("g0", firstGame),
        game("g1", firstGame + ONE_YEAR),
      ]);

      expect(progression.earned).toBe(1);
      // Now counting toward year 2, ~10 days in.
      expect(progression.current).toBeGreaterThan(9 * ONE_DAY);
      expect(progression.current).toBeLessThan(11 * ONE_DAY);
    });

    it("counts multiple earns in the progression earned field", () => {
      const events = [...baseEvents(), game("g0", T0), game("g1", T0 + ONE_YEAR), game("g2", T0 + 2 * ONE_YEAR)];
      expect(progressionFor(events).earned).toBe(2);
    });
  });
});
