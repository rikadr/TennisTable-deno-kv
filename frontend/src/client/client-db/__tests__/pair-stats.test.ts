import { Game } from "../event-store/projectors/games-projector";
import { AGE_HALF_LIFE_DAYS, PairStats } from "../pair-stats";

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2025, 0, 1);

function game(id: number, day: number, winner: string, loser: string, scored = true): Game {
  return {
    id: `game-${id}`,
    playedAt: START + day * DAY,
    winner,
    loser,
    score: scored
      ? {
          setsWon: { gameWinner: 2, gameLoser: 1 },
          setPoints: [
            { gameWinner: 11, gameLoser: 7 },
            { gameWinner: 9, gameLoser: 11 },
            { gameWinner: 11, gameLoser: 5 },
          ],
        }
      : undefined,
  };
}

const GAMES: Game[] = [
  game(1, 0, "A", "B"),
  game(2, 10, "B", "A"),
  game(3, 30, "A", "C", false),
  game(4, 100, "C", "B"),
  game(5, 200, "A", "B"),
  game(6, 400, "D", "A"),
];

const PLAYERS = ["A", "B", "C", "D", "E"];

function expectSameStats(actual: PairStats, expected: PairStats, referenceTime: number) {
  expect([...actual.opponents.keys()].sort()).toEqual([...expected.opponents.keys()].sort());
  for (const p1 of PLAYERS) {
    expect(actual.getTotalGames(p1)).toBe(expected.getTotalGames(p1));
    expect([...(actual.opponents.get(p1) ?? [])].sort()).toEqual([...(expected.opponents.get(p1) ?? [])].sort());
    for (const p2 of PLAYERS) {
      const a = actual.getStats(p1, p2, referenceTime);
      const e = expected.getStats(p1, p2, referenceTime);
      expect(a.raw).toEqual(e.raw);
      expect(a.ageAdjusted.games).toBeCloseTo(e.ageAdjusted.games, 12);
      expect(a.ageAdjusted.sets).toBeCloseTo(e.ageAdjusted.sets, 12);
      expect(a.ageAdjusted.points).toBeCloseTo(e.ageAdjusted.points, 12);
    }
  }
}

describe("PairStats", () => {
  it("weights each game by its age at the reference time", () => {
    const stats = new PairStats(START + 400 * DAY, GAMES);
    const referenceTime = START + 200 * DAY;
    const a = stats.getStats("A", "B", referenceTime);

    // A won game 1 (200 days old) and game 5 (0 days old) against B
    const weight1 = Math.pow(2, -200 / AGE_HALF_LIFE_DAYS);
    expect(a.raw).toEqual({ games: 2, sets: 5, points: 2 * 31 + 23 });
    expect(a.ageAdjusted.games).toBeCloseTo(weight1 + 1, 12);
    expect(a.ageAdjusted.sets).toBeCloseTo(2 * weight1 + 2 + 1 * Math.pow(2, -190 / AGE_HALF_LIFE_DAYS), 12);
  });

  it("gives the same stats at any reference time as stats anchored at that time", () => {
    for (const day of [400, 250, 31]) {
      const time = START + day * DAY;
      const gamesUpTo = GAMES.filter((g) => g.playedAt <= time);
      expectSameStats(new PairStats(START + 400 * DAY, gamesUpTo), new PairStats(time, gamesUpTo), time);
    }
  });

  it("gives the same stats after a rewind as stats built without the later games", () => {
    const stats = new PairStats(START + 400 * DAY, GAMES);
    stats.rewindTo(START + 350 * DAY);
    stats.rewindTo(START + 150 * DAY);
    const time = START + 150 * DAY;

    expect(stats.gameCount).toBe(4);
    expectSameStats(stats, new PairStats(time, GAMES.slice(0, 4)), time);
  });

  it("removes a pair and a player with their last game", () => {
    const stats = new PairStats(START + 400 * DAY, GAMES);
    stats.rewindTo(START + 399 * DAY);

    expect(stats.opponents.has("D")).toBe(false);
    expect(stats.opponents.get("A")?.has("D")).toBe(false);
    expect(stats.getStats("A", "D", START + 400 * DAY).ageAdjusted).toEqual({ games: 0, sets: 0, points: 0 });
    expect(stats.getTotalGames("A")).toBe(4);
  });

  it("gives exactly 0 for a total when the last game that added to it is removed", () => {
    // With these days, subtracting the weights in the reverse order leaves a rounding error
    const stats = new PairStats(START + 100 * DAY, [
      game(1, 0, "A", "B", false),
      game(2, 3, "A", "B"),
      game(3, 7, "A", "B"),
    ]);
    stats.rewindTo(START + 1 * DAY);
    const time = START + 1 * DAY;

    expect(stats.getStats("A", "B", time).ageAdjusted.sets).toBe(0);
    expect(stats.getStats("A", "B", time).ageAdjusted.points).toBe(0);
    expect(stats.getStats("B", "A", time).ageAdjusted).toEqual({ games: 0, sets: 0, points: 0 });
  });

  it("counts a game after the anchor time as played at the anchor time", () => {
    const anchor = START + 100 * DAY;
    const stats = new PairStats(anchor, [game(1, 150, "A", "B")]);

    expect(stats.getStats("A", "B", anchor).ageAdjusted.games).toBe(1);
  });

  it("keeps the stats exact when a rewind goes back over many years", () => {
    // 1 old game, and 500 later games over 15 years. Without a new anchor time, the
    // rounding error of the removals is multiplied by 2^(15 years / half-life)
    const games = [game(0, 0, "A", "B"), ...Array.from({ length: 500 }, (_, i) => game(i + 1, 1 + i * 11, "A", "B"))];
    const stats = new PairStats(START + 5500 * DAY, games);
    for (let day = 5500; day >= 1; day -= 7) stats.rewindTo(START + day * DAY);
    const time = START + 1 * DAY;

    expect(stats.gameCount).toBe(2);
    expectSameStats(stats, new PairStats(time, games.slice(0, 2)), time);
  });

  it("gives the same stats after each advance as stats built from the games up to that time", () => {
    const stats = new PairStats(START, GAMES, 0);
    for (const day of [0, 5, 40, 150, 399, 401]) {
      const time = START + day * DAY;
      stats.advanceTo(time);
      const gamesUpTo = GAMES.filter((g) => g.playedAt <= time);

      expect(stats.gameCount).toBe(gamesUpTo.length);
      expectSameStats(stats, new PairStats(time, gamesUpTo), time);
    }
  });

  it("keeps the stats exact when an advance goes forward over many years", () => {
    const games = Array.from({ length: 500 }, (_, i) =>
      game(i, i * 11, i % 3 === 0 ? "B" : "A", i % 3 === 0 ? "A" : "B"),
    );
    const stats = new PairStats(START, games, 0);
    for (let day = 0; day <= 5500; day += 7) stats.advanceTo(START + day * DAY);
    const time = START + 5500 * DAY;

    expectSameStats(stats, new PairStats(time, games), time);
  });

  it("removes the games after the time at the first rewind", () => {
    const stats = new PairStats(START + 100 * DAY, GAMES);
    stats.rewindTo(START + 100 * DAY);

    expect(stats.gameCount).toBe(4);
    expectSameStats(stats, new PairStats(START + 100 * DAY, GAMES.slice(0, 4)), START + 100 * DAY);
  });

  it("gives each pair once with the same totals as getStats", () => {
    const stats = new PairStats(START + 400 * DAY, GAMES);
    const time = START + 300 * DAY;
    const seen: string[] = [];
    stats.forEachPair(time, (p1, p2, p1Won, p2Won, factor) => {
      seen.push(`${p1}-${p2}`);
      expect(p1 < p2).toBe(true);
      const expected1 = stats.getStats(p1, p2, time).ageAdjusted;
      const expected2 = stats.getStats(p2, p1, time).ageAdjusted;
      for (const key of ["games", "sets", "points"] as const) {
        expect(p1Won[key] * factor).toBeCloseTo(expected1[key], 12);
        expect(p2Won[key] * factor).toBeCloseTo(expected2[key], 12);
      }
    });

    expect(seen.sort()).toEqual(["A-B", "A-C", "A-D", "B-C"]);
  });
});
