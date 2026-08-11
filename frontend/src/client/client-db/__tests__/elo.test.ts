import { Elo } from "../elo";
import { Game } from "../event-store/projectors/games-projector";
import { Player } from "../event-store/projectors/players-projector";

function makePlayer(id: string): Player {
  return { id, name: id, active: true, createdAt: 0, updatedAt: 0 };
}

function makeGame(id: string, playedAt: number, winner: string, loser: string): Game {
  return { id, playedAt, winner, loser };
}

describe("Elo constants", () => {
  it("pins the rating system constants", () => {
    expect(Elo.K).toBe(32);
    expect(Elo.DIVISOR).toBe(400);
    expect(Elo.INITIAL_ELO).toBe(1000);
  });
});

describe("Elo.calculateELO", () => {
  it("gives the winner exactly K/2 = 16 points when ratings are equal", () => {
    const { winnersNewElo, losersNewElo } = Elo.calculateELO(1000, 1000);
    expect(winnersNewElo).toBe(1016);
    expect(losersNewElo).toBe(984);
  });

  it("matches the expected-score formula for a rating gap", () => {
    // Winner at 1000 beats loser at 1200: expected score = 1 / (1 + 10^(200/400))
    const expectedScoreWinner = 1 / (1 + Math.pow(10, (1200 - 1000) / 400));
    const { winnersNewElo } = Elo.calculateELO(1000, 1200);
    expect(winnersNewElo).toBeCloseTo(1000 + 32 * (1 - expectedScoreWinner), 10);
    expect(winnersNewElo - 1000).toBeCloseTo(24.3119, 4);
  });

  it("is zero-sum: the winner gains exactly what the loser loses", () => {
    const pairs: [number, number][] = [
      [1000, 1000],
      [1200, 900],
      [850, 1400],
      [1016, 984],
    ];
    for (const [winnersElo, losersElo] of pairs) {
      const { winnersNewElo, losersNewElo } = Elo.calculateELO(winnersElo, losersElo);
      const winnersGain = winnersNewElo - winnersElo;
      const losersLoss = losersElo - losersNewElo;
      expect(winnersGain).toBeCloseTo(losersLoss, 10);
      expect(winnersGain).toBeGreaterThan(0);
    }
  });

  it("moves more points for an underdog win than for a favourite win", () => {
    const underdogGain = Elo.calculateELO(900, 1100).winnersNewElo - 900;
    const favouriteGain = Elo.calculateELO(1100, 900).winnersNewElo - 1100;

    expect(underdogGain).toBeGreaterThan(favouriteGain);
    // The two gains are mirror images around K/2
    expect(underdogGain + favouriteGain).toBeCloseTo(Elo.K, 10);
  });

  it("never awards more than K or less than 0 points", () => {
    const hugeUpset = Elo.calculateELO(100, 3000).winnersNewElo - 100;
    const totalWalkover = Elo.calculateELO(3000, 100).winnersNewElo - 3000;

    expect(hugeUpset).toBeLessThan(32);
    expect(hugeUpset).toBeGreaterThan(31);
    expect(totalWalkover).toBeGreaterThan(0);
    expect(totalWalkover).toBeLessThan(1);
  });
});

describe("Elo.eloCalculator", () => {
  const players = [makePlayer("p1"), makePlayer("p2"), makePlayer("p3")];

  it("starts every player at 1000 with 0 games", () => {
    const map = Elo.eloCalculator([], players);

    expect(map.size).toBe(3);
    for (const id of ["p1", "p2", "p3"]) {
      expect(map.get(id)!.elo).toBe(1000);
      expect(map.get(id)!.totalGames).toBe(0);
    }
  });

  it("applies a game result to both players and increments totalGames", () => {
    const map = Elo.eloCalculator([makeGame("g1", 1000, "p1", "p2")], players);

    expect(map.get("p1")!.elo).toBe(1016);
    expect(map.get("p2")!.elo).toBe(984);
    expect(map.get("p1")!.totalGames).toBe(1);
    expect(map.get("p2")!.totalGames).toBe(1);
    // Uninvolved player is untouched
    expect(map.get("p3")!.elo).toBe(1000);
    expect(map.get("p3")!.totalGames).toBe(0);
  });

  it("skips games where either player is missing from the player list", () => {
    const games = [
      makeGame("g1", 1000, "p1", "ghost"),
      makeGame("g2", 2000, "ghost", "p2"),
      makeGame("g3", 3000, "p1", "p2"),
    ];
    const map = Elo.eloCalculator(games, players);

    // Only g3 counted
    expect(map.get("p1")!.elo).toBe(1016);
    expect(map.get("p1")!.totalGames).toBe(1);
    expect(map.get("p2")!.elo).toBe(984);
    expect(map.get("p2")!.totalGames).toBe(1);
    expect(map.has("ghost")).toBe(false);
  });

  it("conserves the total number of points across all games", () => {
    const games = [
      makeGame("g1", 1000, "p1", "p2"),
      makeGame("g2", 2000, "p2", "p3"),
      makeGame("g3", 3000, "p3", "p1"),
      makeGame("g4", 4000, "p1", "p2"),
    ];
    const map = Elo.eloCalculator(games, players);
    const total = Array.from(map.values()).reduce((sum, player) => sum + player.elo, 0);

    expect(total).toBeCloseTo(3 * 1000, 8);
  });

  it("invokes onGameResult with the updated map and the correct pointsWon", () => {
    const games = [makeGame("g1", 1000, "p1", "p2"), makeGame("g2", 2000, "p2", "p1")];
    const calls: { gameId: string; pointsWon: number; winnersEloAfter: number }[] = [];

    Elo.eloCalculator(games, players, (map, game, pointsWon) => {
      calls.push({ gameId: game.id, pointsWon, winnersEloAfter: map.get(game.winner)!.elo });
    });

    expect(calls).toHaveLength(2);
    // First game: equal ratings, winner gains exactly 16
    expect(calls[0].gameId).toBe("g1");
    expect(calls[0].pointsWon).toBe(16);
    expect(calls[0].winnersEloAfter).toBe(1016);
    // Second game: p2 (984) beats p1 (1016) as underdog, so gains more than 16
    expect(calls[1].gameId).toBe("g2");
    expect(calls[1].pointsWon).toBeGreaterThan(16);
    const expectedScore = 1 / (1 + Math.pow(10, (1016 - 984) / 400));
    expect(calls[1].pointsWon).toBeCloseTo(32 * (1 - expectedScore), 10);
  });

  it("does not invoke onGameResult for skipped games", () => {
    const games = [makeGame("g1", 1000, "p1", "ghost")];
    const calls: string[] = [];

    Elo.eloCalculator(games, players, (_map, game) => {
      calls.push(game.id);
    });

    expect(calls).toHaveLength(0);
  });
});
