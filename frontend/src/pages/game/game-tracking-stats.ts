/**
 * Reads the timing and serve data a tracked game stores, and turns it into the
 * numbers the game details page shows.
 *
 * Every time in `GameTracking` is a delta in tenths of a second from the
 * previous point, so anything absolute is rebuilt by summing them.
 */

import { GameTracking } from "../../client/client-db/event-store/event-types";
import { getServeInfo, Server } from "../../common/serve-tracker";

const TENTH_MS = 100;

export type GameTimingStats = {
  /** Ms from the start of tracking to the last point. */
  durationMs: number;
  /** Ms each set took, from its first point to its last point. */
  setDurationsMs: number[];
  /** Ms between two points, on average, excluding the breaks between sets. */
  averagePointGapMs: number;
  /** The longest gap between two points, excluding the breaks between sets. */
  longestPointGapMs: number;
};

/**
 * The gaps between points inside a set. The first delta of a set is the break
 * since the previous point of the game, so it is not a gap between two points
 * of the same set and is left out.
 */
function withinSetGaps(tracking: GameTracking): number[] {
  return tracking.pointDeltas.flatMap((deltas) => deltas.slice(1));
}

export function gameTimingStats(tracking: GameTracking): GameTimingStats {
  const gaps = withinSetGaps(tracking);
  const totalTenths = tracking.pointDeltas.reduce(
    (total, deltas) => total + deltas.reduce((sum, delta) => sum + delta, 0),
    0,
  );
  return {
    durationMs: totalTenths * TENTH_MS,
    setDurationsMs: tracking.pointDeltas.map(
      (deltas) => deltas.slice(1).reduce((sum, delta) => sum + delta, 0) * TENTH_MS,
    ),
    averagePointGapMs:
      gaps.length === 0 ? 0 : (gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) * TENTH_MS,
    longestPointGapMs: gaps.length === 0 ? 0 : Math.max(...gaps) * TENTH_MS,
  };
}

export type ServeStats = {
  /** Points played on this player's serve, and how many of them the player won. */
  winner: { served: number; won: number };
  loser: { served: number; won: number };
};

/**
 * Counts how each player did on their own serve. The server of a point follows
 * from who served first in the set and the score at that point, the same rule
 * the live serve tracker shows.
 */
export function serveStats(pointSequences: string[], firstServers: string): ServeStats {
  const stats: ServeStats = { winner: { served: 0, won: 0 }, loser: { served: 0, won: 0 } };

  pointSequences.forEach((sequence, setIndex) => {
    // The game winner is slot 1 here, so the set score is counted their way.
    const firstServer: Server = firstServers[setIndex] === "W" ? 1 : 2;
    let winnerPoints = 0;
    let loserPoints = 0;

    for (const point of sequence) {
      const { server } = getServeInfo({ player1: winnerPoints, player2: loserPoints }, firstServer);
      const winnerScored = point === "W";
      const side = server === 1 ? stats.winner : stats.loser;
      side.served++;
      if (winnerScored === (server === 1)) side.won++;
      if (winnerScored) winnerPoints++;
      else loserPoints++;
    }
  });

  return stats;
}

/** A duration as "1h 04m", "4m 12s" or "38s". */
export function durationString(ms: number): string {
  const totalSeconds = Math.round(ms / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/** A short gap as "7.4s". Point gaps are short enough to keep the tenth. */
export function gapString(ms: number): string {
  if (ms >= 60_000) return durationString(ms);
  return `${(ms / 1_000).toFixed(1)}s`;
}
