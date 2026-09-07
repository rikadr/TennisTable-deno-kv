// The Hall of Fame score per category, for one player or for all players.

import { HallOfFameEntry } from "../../client/client-db/hall-of-fame";
import { FACTORS } from "../hall-of-fame/hall-of-fame-factors";
import { RankedEntry } from "./what-changed-diff";

/** The player selection that sums every player instead of showing one. */
export const ALL_PLAYERS = "all-players";

/**
 * One entry per category of the Hall of Fame score, biggest score first. The
 * rank ranks the categories against each other, so rank 1 is the category
 * that gives the most points in the selection. Categories with an equal score
 * share a rank.
 *
 * `entries` is the Hall of Fame leaderboard at one of the two times.
 * Undefined means that the state at that time is not known, and the result is
 * undefined as well. An empty result means that the selection has no score at
 * that time, so no category has a rank.
 */
export function hallOfFameCategoryEntries(
  entries: HallOfFameEntry[] | undefined,
  playerId: string,
): RankedEntry[] | undefined {
  if (entries === undefined) return undefined;

  const selected = playerId === ALL_PLAYERS ? entries : entries.filter((entry) => entry.playerId === playerId);
  if (selected.length === 0) return [];

  const scores = FACTORS.map((factor) => ({
    key: factor.key,
    score: selected.reduce((sum, entry) => sum + entry.score[factor.key].score, 0),
  }));

  // The same shared rank loop that the Hall of Fame uses for its section
  // ranks: an equal score gives an equal rank.
  const sorted = scores.sort((a, b) => b.score - a.score);
  const ranked: RankedEntry[] = [];
  let currentRank = 0;
  let lastScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].score !== lastScore) {
      currentRank = i + 1;
      lastScore = sorted[i].score;
    }
    ranked.push({ id: sorted[i].key, rank: currentRank, score: sorted[i].score });
  }
  return ranked;
}
