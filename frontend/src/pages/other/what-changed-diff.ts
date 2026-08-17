// Row and sort logic of the What changed leaderboard diff tables.

/** One entry of a leaderboard: the player, the rank and the score. */
export type RankedEntry = { id: string; rank: number; score: number };

/**
 * The rank and the score of one player at the two selected times. A missing
 * rank or score means the player was not on the leaderboard at that time.
 */
export type DiffRow = {
  playerId: string;
  startRank?: number;
  endRank?: number;
  startScore?: number;
  endScore?: number;
};

export type SortBy = "start" | "end" | "delta";

/**
 * The score of a player who is absent from one of the two leaderboards. It
 * makes the score delta of a player who joins or leaves the leaderboard
 * comparable to the delta of a player who is on both leaderboards.
 *
 * A Hall of Fame score and a season score start at 0, so a player who joins
 * gains the full score. An elo has no such start point, so the overall
 * leaderboard reads the elo that the player had at that time instead. A
 * function that returns undefined leaves the delta unknown.
 */
export type AbsentScore = (playerId: string, side: "start" | "end") => number | undefined;

/** For a leaderboard whose score starts at 0. */
export const absentScoreZero: AbsentScore = () => 0;

/** The score change between the two times, or undefined when it is unknown. */
export function scoreDelta(row: DiffRow, absentScore?: AbsentScore): number | undefined {
  const start = row.startScore ?? absentScore?.(row.playerId, "start");
  const end = row.endScore ?? absentScore?.(row.playerId, "end");
  if (start === undefined || end === undefined) return undefined;
  return end - start;
}

// Ascending rank order. A missing rank sorts last.
function compareRank(a: number | undefined, b: number | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a - b;
}

// Biggest score gain first. A row with an unknown delta sorts last.
function compareDelta(a: number | undefined, b: number | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return b - a;
}

/** One row per player on either leaderboard, in the selected sort order. */
export function buildDiffRows(
  startEntries: RankedEntry[] | undefined,
  endEntries: RankedEntry[] | undefined,
  sortBy: SortBy,
  absentScore?: AbsentScore,
): DiffRow[] {
  const rowMap = new Map<string, DiffRow>();
  startEntries?.forEach((player) => {
    rowMap.set(player.id, { playerId: player.id, startRank: player.rank, startScore: player.score });
  });
  endEntries?.forEach((player) => {
    const row = rowMap.get(player.id) ?? { playerId: player.id };
    row.endRank = player.rank;
    row.endScore = player.score;
    rowMap.set(player.id, row);
  });

  const list = Array.from(rowMap.values());

  if (sortBy === "delta") {
    return list.sort(
      (a, b) =>
        compareDelta(scoreDelta(a, absentScore), scoreDelta(b, absentScore)) || compareRank(a.endRank, b.endRank),
    );
  }

  const sortRank = (row: DiffRow) => (sortBy === "start" ? row.startRank : row.endRank);
  const fallbackRank = (row: DiffRow) => (sortBy === "start" ? row.endRank : row.startRank);
  return list.sort((a, b) => compareRank(sortRank(a), sortRank(b)) || compareRank(fallbackRank(a), fallbackRank(b)));
}
