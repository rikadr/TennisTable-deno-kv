import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("TennisTable", () => {
  describe("Reunion", () => {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const ONE_YEAR = 365 * ONE_DAY;
    const T0 = 1_500_000_000_000; // fixed base time, well in the past

    const baseEvents = (): EventType[] => [
      { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
      { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
      { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
    ];

    const game = (id: string, playedAt: number, winner = "alice", loser = "bob"): EventType => ({
      type: EventTypeEnum.GAME_CREATED,
      stream: id,
      time: playedAt,
      data: { winner, loser, playedAt },
    });

    function reunionsFor(events: EventType[], playerId: string) {
      const tt = new TennisTable({ events });
      tt.achievements.calculateAchievements();
      return tt.achievements.getAchievements(playerId).filter((a) => a.type === "reunion");
    }

    it("awards both players when the pair's previous game was exactly one year ago", () => {
      const events = [...baseEvents(), game("g0", T0), game("g1", T0 + ONE_YEAR)];

      for (const [player, opponent] of [
        ["alice", "bob"],
        ["bob", "alice"],
      ]) {
        const earned = reunionsFor(events, player);
        expect(earned).toHaveLength(1);
        expect(earned[0]).toStrictEqual({
          type: "reunion",
          earnedBy: player,
          earnedAt: T0 + ONE_YEAR,
          data: { gameId: "g1", opponent, lastGameAt: T0 },
        });
      }
    });

    it("does not award when the gap is just short of one year", () => {
      const events = [...baseEvents(), game("g0", T0), game("g1", T0 + ONE_YEAR - 1)];
      expect(reunionsFor(events, "alice")).toHaveLength(0);
      expect(reunionsFor(events, "bob")).toHaveLength(0);
    });

    it("does not award on a pair's first ever game", () => {
      const events = [...baseEvents(), game("g0", T0)];
      expect(reunionsFor(events, "alice")).toHaveLength(0);
      expect(reunionsFor(events, "bob")).toHaveLength(0);
    });

    it("measures the gap per opponent pair — games against others in between do not reset it", () => {
      // Alice plays Bob once, then plays Carol every month for a year, then
      // plays Bob again. Alice was active the whole time, but the Alice–Bob
      // gap still spans the full year.
      const events = [...baseEvents(), game("g0", T0, "alice", "bob")];
      for (let month = 1; month <= 11; month++) {
        events.push(game(`gc${month}`, T0 + month * 30 * ONE_DAY, "alice", "carol"));
      }
      events.push(game("g1", T0 + ONE_YEAR, "alice", "bob"));

      const earned = reunionsFor(events, "alice");
      expect(earned).toHaveLength(1);
      expect(earned[0].data).toStrictEqual({ gameId: "g1", opponent: "bob", lastGameAt: T0 });
      // Bob earns it too — the gap belongs to the pair.
      expect(reunionsFor(events, "bob")).toHaveLength(1);
    });

    it("measures the gap from the pair's most recent game, not their first", () => {
      // Games at T0 and T0 + 6 months; a game a year after T0 is only 6
      // months after the pair's latest game, so no reunion.
      const events = [...baseEvents(), game("g0", T0), game("g1", T0 + 182 * ONE_DAY), game("g2", T0 + ONE_YEAR)];
      expect(reunionsFor(events, "alice")).toHaveLength(0);
    });

    it("win or lose does not matter — the returning loser earns it too", () => {
      const events = [...baseEvents(), game("g0", T0, "alice", "bob"), game("g1", T0 + ONE_YEAR, "bob", "alice")];
      expect(reunionsFor(events, "alice")).toHaveLength(1);
      expect(reunionsFor(events, "bob")).toHaveLength(1);
    });

    it("only the game that closes the gap awards — an immediate rematch does not", () => {
      const events = [
        ...baseEvents(),
        game("g0", T0),
        game("g1", T0 + ONE_YEAR),
        game("g2", T0 + ONE_YEAR + 1000), // rematch minutes later
      ];
      const earned = reunionsFor(events, "alice");
      expect(earned).toHaveLength(1);
      expect(earned[0].data.gameId).toBe("g1");
    });

    it("can be earned again with the same opponent after another year-long gap", () => {
      const events = [
        ...baseEvents(),
        game("g0", T0),
        game("g1", T0 + ONE_YEAR),
        game("g2", T0 + 2 * ONE_YEAR + ONE_DAY),
      ];
      const earned = reunionsFor(events, "alice").sort((a, b) => a.earnedAt - b.earnedAt);
      expect(earned).toHaveLength(2);
      expect(earned.map((a) => a.data.gameId)).toStrictEqual(["g1", "g2"]);
    });

    it("can be earned with several opponents independently", () => {
      const events = [
        ...baseEvents(),
        game("g0", T0, "alice", "bob"),
        game("g1", T0 + ONE_DAY, "alice", "carol"),
        game("g2", T0 + ONE_YEAR, "alice", "bob"),
        game("g3", T0 + ONE_YEAR + ONE_DAY, "alice", "carol"),
      ];
      const earned = reunionsFor(events, "alice").sort((a, b) => a.earnedAt - b.earnedAt);
      expect(earned).toHaveLength(2);
      expect(earned.map((a) => a.data.opponent)).toStrictEqual(["bob", "carol"]);
    });

    it("awards a gap far beyond one year once — there are no higher tiers", () => {
      const events = [...baseEvents(), game("g0", T0), game("g1", T0 + 3 * ONE_YEAR)];
      const earned = reunionsFor(events, "alice");
      expect(earned).toHaveLength(1);
      expect(earned[0].data.lastGameAt).toBe(T0);
    });

    // --- Progression --------------------------------------------------------

    function progressionFor(events: EventType[], playerId = "alice") {
      const tt = new TennisTable({ events });
      tt.achievements.calculateAchievements();
      return tt.achievements.getPlayerProgression(playerId).reunion;
    }

    it("tracks the longest open gap against an active opponent", () => {
      const lastBobGame = Date.now() - 100 * ONE_DAY;
      const events = [
        ...baseEvents(),
        game("g0", lastBobGame, "alice", "bob"),
        game("g1", Date.now() - 10 * ONE_DAY, "alice", "carol"),
      ];
      const progression = progressionFor(events);

      expect(progression.earned).toBe(0);
      expect(progression.target).toBe(ONE_YEAR);
      expect(progression.current).toBeGreaterThan(99 * ONE_DAY);
      expect(progression.current).toBeLessThan(101 * ONE_DAY);
      // Every active opponent's open gap is listed, Bob's the longest.
      expect(progression.perOpponent?.size).toBe(2);
      expect(progression.perOpponent?.get("bob")).toBe(progression.current);
      expect(progression.perOpponent?.get("carol")).toBeLessThan(11 * ONE_DAY);
      // The open gap is also the player's best so far.
      expect(progression.best).toBe(progression.current);
      expect(progression.bestOpponent).toBe("bob");
    });

    it("ignores open gaps against deactivated opponents", () => {
      const events = [
        ...baseEvents(),
        game("g0", Date.now() - 100 * ONE_DAY, "alice", "bob"),
        game("g1", Date.now() - 10 * ONE_DAY, "alice", "carol"),
        {
          type: EventTypeEnum.PLAYER_DEACTIVATED,
          stream: "bob",
          time: Date.now() - 5 * ONE_DAY,
          data: null,
        } as EventType,
      ];
      const progression = progressionFor(events);

      // Bob is retired, so the chase points at Carol's 10-day gap instead.
      expect(progression.current).toBeGreaterThan(9 * ONE_DAY);
      expect(progression.current).toBeLessThan(11 * ONE_DAY);
      expect(progression.perOpponent?.has("bob")).toBe(false);
      expect(progression.perOpponent?.has("carol")).toBe(true);
    });

    it("keeps the longest closed gap as the best value", () => {
      // A 200-day gap closed long ago; every open gap now is shorter.
      const events = [
        ...baseEvents(),
        game("g0", Date.now() - 250 * ONE_DAY, "alice", "bob"),
        game("g1", Date.now() - 50 * ONE_DAY, "alice", "bob"),
        game("g2", Date.now() - ONE_DAY, "alice", "bob"),
      ];
      const progression = progressionFor(events);

      expect(progression.best).toBe(200 * ONE_DAY);
      expect(progression.bestOpponent).toBe("bob");
    });

    it("counts each earn in the progression earned field", () => {
      const events = [
        ...baseEvents(),
        game("g0", T0),
        game("g1", T0 + ONE_YEAR),
        game("g2", T0 + 2 * ONE_YEAR + ONE_DAY),
      ];
      expect(progressionFor(events).earned).toBe(2);
    });

    it("has no progress before the player has any opponent history", () => {
      const progression = progressionFor([...baseEvents()]);
      expect(progression.current).toBe(0);
      expect(progression.earned).toBe(0);
      expect(progression.perOpponent?.size).toBe(0);
      expect(progression.best).toBeUndefined();
    });
  });
});
