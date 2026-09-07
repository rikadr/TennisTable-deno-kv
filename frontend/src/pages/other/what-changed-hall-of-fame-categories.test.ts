import { HallOfFameEntry, HallOfFameFactorKey } from "../../client/client-db/hall-of-fame";
import { ALL_PLAYERS, hallOfFameCategoryEntries } from "./what-changed-hall-of-fame-categories";

// A Hall of Fame entry needs all 9 sections with their detail fields, so the
// helper fills every category that the test does not set with 0.
function player(playerId: string, scores: Partial<Record<HallOfFameFactorKey, number>>): HallOfFameEntry {
  const score = (key: HallOfFameFactorKey) => scores[key] ?? 0;
  return {
    playerId,
    playerName: playerId,
    score: {
      seasonPerformance: { score: score("seasonPerformance"), seasons: [] },
      achievementsEarned: { score: score("achievementsEarned"), count: 0 },
      socialDiversity: { score: score("socialDiversity"), uniqueOpponents: 0 },
      tournamentProgression: { score: score("tournamentProgression"), tournaments: [] },
      longevity: { score: score("longevity"), activeDays: 0 },
      experience: { score: score("experience"), gamesWon: 0, gamesLost: 0 },
      dataVolume: {
        score: score("dataVolume"),
        gamesWithSets: 0,
        gamesWithPoints: 0,
        liveTrackedGames: 0,
        gamesWithBadSide: 0,
      },
      peakElo: { score: score("peakElo"), peakElo: 0 },
      podiumTime: { score: score("podiumTime"), rank1Days: 0, rank2to3Days: 0, rank4to5Days: 0 },
      total: 0,
    },
  };
}

describe("hall of fame category entries", () => {
  const entries = [
    player("a", { peakElo: 100, experience: 40, achievementsEarned: 10 }),
    player("b", { peakElo: 60, experience: 40, longevity: 25 }),
  ];

  it("gives one entry per category", () => {
    const rows = hallOfFameCategoryEntries(entries, ALL_PLAYERS);
    expect(rows).toHaveLength(9);
    expect(new Set(rows?.map((row) => row.id)).size).toBe(9);
  });

  it("scores the categories of one player", () => {
    const rows = hallOfFameCategoryEntries(entries, "a");
    const scores = new Map(rows?.map((row) => [row.id, row.score]));
    expect(scores.get("peakElo")).toBe(100);
    expect(scores.get("experience")).toBe(40);
    expect(scores.get("achievementsEarned")).toBe(10);
    expect(scores.get("longevity")).toBe(0);
  });

  it("sums each category over all players", () => {
    const rows = hallOfFameCategoryEntries(entries, ALL_PLAYERS);
    const scores = new Map(rows?.map((row) => [row.id, row.score]));
    expect(scores.get("peakElo")).toBe(160);
    expect(scores.get("experience")).toBe(80);
    expect(scores.get("achievementsEarned")).toBe(10);
    expect(scores.get("longevity")).toBe(25);
  });

  it("ranks the biggest category first", () => {
    const rows = hallOfFameCategoryEntries(entries, ALL_PLAYERS);
    expect(rows?.[0]).toEqual({ id: "peakElo", rank: 1, score: 160 });
    expect(rows?.[1]).toEqual({ id: "experience", rank: 2, score: 80 });
  });

  it("gives categories with an equal score the same rank", () => {
    const equal = [player("a", { peakElo: 10, experience: 10 })];
    const rows = hallOfFameCategoryEntries(equal, "a");
    expect(rows?.filter((row) => row.score === 10).map((row) => row.rank)).toEqual([1, 1]);
    // The 7 categories that score 0 come after the 2 that score 10.
    expect(rows?.filter((row) => row.score === 0).map((row) => row.rank)).toEqual([3, 3, 3, 3, 3, 3, 3]);
  });

  it("gives no category when the player has no entry", () => {
    expect(hallOfFameCategoryEntries(entries, "unknown-player")).toEqual([]);
  });

  it("gives no category when no player has a score", () => {
    expect(hallOfFameCategoryEntries([], ALL_PLAYERS)).toEqual([]);
  });

  it("gives undefined when the state is not known", () => {
    expect(hallOfFameCategoryEntries(undefined, ALL_PLAYERS)).toBeUndefined();
  });
});
