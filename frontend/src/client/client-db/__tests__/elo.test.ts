import { Elo } from "../elo";
import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";

// Provisional rating system: games played after PROVISIONAL_EPOCH rate each
// player with their own K-factor — inflated for a player's unranked games
// and decayed back to exactly the standard K on the game that makes them
// ranked (totalGames >= gameLimitForRanked). Games from before the epoch
// (and all existing test fixtures with small timestamps) keep the legacy
// fixed-K, zero-sum behaviour.

const POST_EPOCH = Elo.PROVISIONAL_EPOCH + 1_000;
const GAME_LIMIT = 5;

describe("Elo provisional K-factor", () => {
  describe("kFactor", () => {
    it("uses the standard K for games before the provisional epoch", () => {
      expect(Elo.kFactor(1, Elo.PROVISIONAL_EPOCH - 1, GAME_LIMIT)).toBe(Elo.K);
      expect(Elo.kFactor(5, 1000, GAME_LIMIT)).toBe(Elo.K);
    });

    it("uses the standard K when no game time or ranked limit is given", () => {
      expect(Elo.kFactor(1)).toBe(Elo.K);
      expect(Elo.kFactor(1, POST_EPOCH)).toBe(Elo.K);
      expect(Elo.kFactor(1, POST_EPOCH, 0)).toBe(Elo.K);
    });

    it("decays from PROVISIONAL_K_MAX to K across the unranked games", () => {
      expect(Elo.kFactor(1, POST_EPOCH, GAME_LIMIT)).toBe(100);
      expect(Elo.kFactor(2, POST_EPOCH, GAME_LIMIT)).toBe(83);
      expect(Elo.kFactor(3, POST_EPOCH, GAME_LIMIT)).toBe(66);
      expect(Elo.kFactor(4, POST_EPOCH, GAME_LIMIT)).toBe(49);
    });

    it("is exactly the standard K from the game that makes a player ranked", () => {
      expect(Elo.kFactor(GAME_LIMIT, POST_EPOCH, GAME_LIMIT)).toBe(Elo.K);
      expect(Elo.kFactor(GAME_LIMIT + 1, POST_EPOCH, GAME_LIMIT)).toBe(Elo.K);
      expect(Elo.kFactor(100, POST_EPOCH, GAME_LIMIT)).toBe(Elo.K);
    });

    it("respects the client's ranked limit for the decay window", () => {
      // With a limit of 1 the first game already makes you ranked, so
      // there is no provisional boost at all.
      expect(Elo.kFactor(1, POST_EPOCH, 1)).toBe(Elo.K);
      expect(Elo.kFactor(1, POST_EPOCH, 2)).toBe(100);
      expect(Elo.kFactor(2, POST_EPOCH, 2)).toBe(Elo.K);
      expect(Elo.kFactor(1, POST_EPOCH, 10)).toBe(100);
      expect(Elo.kFactor(2, POST_EPOCH, 10)).toBeCloseTo(32 + 68 * (8 / 9), 10);
      expect(Elo.kFactor(10, POST_EPOCH, 10)).toBe(Elo.K);
      expect(Elo.kFactor(11, POST_EPOCH, 10)).toBe(Elo.K);
    });

    it("starts the provisional window exactly at the epoch", () => {
      expect(Elo.kFactor(1, Elo.PROVISIONAL_EPOCH, GAME_LIMIT)).toBe(Elo.PROVISIONAL_K_MAX);
    });

    it("never exceeds PROVISIONAL_K_MAX even for a zero game count", () => {
      expect(Elo.kFactor(0, POST_EPOCH, GAME_LIMIT)).toBe(Elo.PROVISIONAL_K_MAX);
    });
  });

  describe("calculateELO", () => {
    it("keeps the legacy zero-sum exchange for pre-epoch games", () => {
      const { winnersNewElo, losersNewElo } = Elo.calculateELO(1000, 1000, 1, 6, 1000, GAME_LIMIT);
      expect(winnersNewElo).toBeCloseTo(1016, 10);
      expect(losersNewElo).toBeCloseTo(984, 10);
    });

    it("keeps the legacy exchange when no ranked limit is provided", () => {
      const { winnersNewElo, losersNewElo } = Elo.calculateELO(1000, 1000, 1, 1, POST_EPOCH);
      expect(winnersNewElo).toBeCloseTo(1016, 10);
      expect(losersNewElo).toBeCloseTo(984, 10);
    });

    it("rates two brand-new players with the full provisional K", () => {
      const { winnersNewElo, losersNewElo } = Elo.calculateELO(1000, 1000, 1, 1, POST_EPOCH, GAME_LIMIT);
      expect(winnersNewElo).toBeCloseTo(1050, 10);
      expect(losersNewElo).toBeCloseTo(950, 10);
    });

    it("rates each player with their own K — newcomer vs ranked is not zero-sum", () => {
      // New winner (game 1, K=100) beats ranked loser (game 6, K=32)
      const newcomerWins = Elo.calculateELO(1000, 1000, 1, 6, POST_EPOCH, GAME_LIMIT);
      expect(newcomerWins.winnersNewElo).toBeCloseTo(1050, 10);
      expect(newcomerWins.losersNewElo).toBeCloseTo(984, 10);

      // Ranked winner (game 6, K=32) beats new loser (game 1, K=100)
      const rankedWins = Elo.calculateELO(1000, 1000, 6, 1, POST_EPOCH, GAME_LIMIT);
      expect(rankedWins.winnersNewElo).toBeCloseTo(1016, 10);
      expect(rankedWins.losersNewElo).toBeCloseTo(950, 10);
    });
  });

  describe("through TennisTable", () => {
    const createPlayer = (id: string, time: number): EventType => ({
      time,
      stream: id,
      type: EventTypeEnum.PLAYER_CREATED,
      data: { name: id },
    });

    const game = (id: string, time: number, winner: string, loser: string): EventType => ({
      time,
      stream: id,
      type: EventTypeEnum.GAME_CREATED,
      data: { playedAt: time, winner, loser },
    });

    it("keeps pre-epoch history zero-sum", () => {
      const events: EventType[] = [
        createPlayer("a", 1),
        createPlayer("b", 2),
        createPlayer("c", 3),
        game("g1", 100, "a", "b"),
        game("g2", 200, "b", "c"),
        game("g3", 300, "c", "a"),
        game("g4", 400, "a", "c"),
      ];
      const tt = new TennisTable({ events });

      const eloSum = ["a", "b", "c"]
        .map((id) => tt.leaderboard.getPlayerSummary(id).elo)
        .reduce((sum, elo) => sum + elo, 0);
      expect(eloSum).toBeCloseTo(3 * Elo.INITIAL_ELO, 8);

      // First game between two fresh players moves exactly K/2 each way.
      const aSummary = tt.leaderboard.getPlayerSummary("a");
      expect(aSummary.games[0].pointsDiff).toBeCloseTo(16, 10);
    });

    it("post-epoch: each side's points diff uses their own K-factor", () => {
      const events: EventType[] = [createPlayer("a", 1), createPlayer("b", 2), createPlayer("c", 3)];
      // b plays enough post-epoch games against c to be ranked, so b's K
      // is fully decayed back to standard.
      let t = POST_EPOCH;
      for (let i = 0; i < 8; i++) {
        events.push(game(`warmup-${i}`, t++, "b", "c"));
      }
      // a's first game (K=100) against ranked b (K=32).
      events.push(game("upset", t++, "a", "b"));

      const tt = new TennisTable({ events });
      const aSummary = tt.leaderboard.getPlayerSummary("a");
      const bSummary = tt.leaderboard.getPlayerSummary("b");

      const aDiff = aSummary.games[aSummary.games.length - 1].pointsDiff;
      const bDiff = bSummary.games[bSummary.games.length - 1].pointsDiff;

      // Winner gain = K_winner * p, loser loss = K_loser * p for the same
      // upset probability p, so the ratio is exactly 100/32.
      expect(aDiff).toBeGreaterThan(0);
      expect(bDiff).toBeLessThan(0);
      expect(aDiff / -bDiff).toBeCloseTo(Elo.PROVISIONAL_K_MAX / Elo.K, 6);
      expect(aSummary.elo).toBeCloseTo(Elo.INITIAL_ELO + aDiff, 8);
    });

    it("post-epoch: two newcomers exchange the full provisional swing", () => {
      const events: EventType[] = [
        createPlayer("a", 1),
        createPlayer("b", 2),
        game("g1", POST_EPOCH, "a", "b"),
      ];
      const tt = new TennisTable({ events });

      expect(tt.leaderboard.getPlayerSummary("a").elo).toBeCloseTo(1050, 10);
      expect(tt.leaderboard.getPlayerSummary("b").elo).toBeCloseTo(950, 10);
    });
  });
});
