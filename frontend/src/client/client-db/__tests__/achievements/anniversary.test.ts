import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("TennisTable", () => {
  describe("Anniversary", () => {
    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const T0 = 1_700_000_000_000; // fixed base time for the player's first ever game

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
          data: { firstGameAt: T0 },
        });
      }
    });

    it("awards when the game is exactly one day before the anniversary", () => {
      const events = [...baseEvents(), game("g0", T0), game("g1", T0 + ONE_YEAR - ONE_DAY)];
      const earned = anniversariesFor(events, "alice");
      expect(earned).toHaveLength(1);
      expect(earned[0].earnedAt).toBe(T0 + ONE_YEAR - ONE_DAY);
    });

    it("awards when the game is exactly one day after the anniversary", () => {
      const events = [...baseEvents(), game("g0", T0), game("g1", T0 + ONE_YEAR + ONE_DAY)];
      const earned = anniversariesFor(events, "alice");
      expect(earned).toHaveLength(1);
      expect(earned[0].earnedAt).toBe(T0 + ONE_YEAR + ONE_DAY);
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

    it("awards only once even when multiple games fall inside the window", () => {
      const events = [
        ...baseEvents(),
        game("g0", T0),
        game("g1", T0 + ONE_YEAR - ONE_DAY),
        game("g2", T0 + ONE_YEAR),
        game("g3", T0 + ONE_YEAR + ONE_DAY),
      ];
      const earned = anniversariesFor(events, "alice");
      expect(earned).toHaveLength(1);
      // Earned on the first qualifying game (one day before the anniversary).
      expect(earned[0].earnedAt).toBe(T0 + ONE_YEAR - ONE_DAY);
    });

    it("uses each player's own first game as the anchor", () => {
      // Alice's first game is at T0. Bob debuts later (against Carol), so Bob's
      // anniversary window is anchored to his own debut, not Alice's.
      const bobFirst = T0 + 100 * ONE_DAY;
      const events: EventType[] = [
        { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
        { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 2, data: { name: "Carol" } },
        { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 3, data: { name: "Bob" } },
        game("g0", T0, "alice", "carol"),
        game("gBobDebut", bobFirst, "bob", "alice"),
        // A game on Alice's anniversary — Alice earns, Bob does not (too early for him).
        game("gAliceAnniv", T0 + ONE_YEAR, "alice", "bob"),
        // A game on Bob's anniversary — Bob earns now.
        game("gBobAnniv", bobFirst + ONE_YEAR, "bob", "alice"),
      ];

      const alice = anniversariesFor(events, "alice");
      expect(alice).toHaveLength(1);
      expect(alice[0]).toStrictEqual({
        type: "anniversary",
        earnedBy: "alice",
        earnedAt: T0 + ONE_YEAR,
        data: { firstGameAt: T0 },
      });

      const bob = anniversariesFor(events, "bob");
      expect(bob).toHaveLength(1);
      expect(bob[0]).toStrictEqual({
        type: "anniversary",
        earnedBy: "bob",
        earnedAt: bobFirst + ONE_YEAR,
        data: { firstGameAt: bobFirst },
      });
    });

    it("reflects the earned count in player progression", () => {
      const events = [...baseEvents(), game("g0", T0), game("g1", T0 + ONE_YEAR)];
      const tt = new TennisTable({ events });
      tt.achievements.calculateAchievements();
      expect(tt.achievements.getPlayerProgression("alice").anniversary.earned).toBe(1);
    });
  });
});
