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
    averagePointGapMs:
      gaps.length === 0 ? 0 : (gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) * TENTH_MS,
    longestPointGapMs: gaps.length === 0 ? 0 : Math.max(...gaps) * TENTH_MS,
  };
}

export type SetBreakdown = {
  /** 1-based number of the set. */
  set: number;
  points: { winner: number; loser: number };
  /** True when the game winner also won this set. */
  wonByGameWinner: boolean;
  /** Who served the first point of the set. */
  firstServer: "W" | "L";
  /** Ms from the first point of the set to its last point. */
  durationMs: number;
  /** Ms between the last point of the previous set and the first of this one. */
  breakBeforeMs: number;
  /** The longest gap between two points of this set. */
  longestPointGapMs: number;
};

/**
 * One row per set: the score, who served it first, and how long it took. The
 * first delta of a set is the break before it, so it is the break time and not
 * part of the duration of the set.
 */
export function setBreakdown(pointSequences: string[], tracking: GameTracking): SetBreakdown[] {
  return pointSequences.map((sequence, index) => {
    const deltas = tracking.pointDeltas[index] ?? [];
    const gaps = deltas.slice(1);
    const winnerPoints = sequence.split("").filter((point) => point === "W").length;
    return {
      set: index + 1,
      points: { winner: winnerPoints, loser: sequence.length - winnerPoints },
      wonByGameWinner: winnerPoints > sequence.length - winnerPoints,
      firstServer: tracking.firstServers[index] === "W" ? "W" : "L",
      durationMs: gaps.reduce((sum, gap) => sum + gap, 0) * TENTH_MS,
      breakBeforeMs: (deltas[0] ?? 0) * TENTH_MS,
      longestPointGapMs: gaps.length === 0 ? 0 : Math.max(...gaps) * TENTH_MS,
    };
  });
}

/** The longest run of points in a row that each player won, over the game. */
export function longestStreaks(pointSequences: string[]): { winner: number; loser: number } {
  const longest = { winner: 0, loser: 0 };
  let current = 0;
  let currentPoint = "";

  // A streak carries across a set boundary: the points are still consecutive.
  for (const point of pointSequences.join("")) {
    current = point === currentPoint ? current + 1 : 1;
    currentPoint = point;
    const side = point === "W" ? "winner" : "loser";
    longest[side] = Math.max(longest[side], current);
  }

  return longest;
}

export type GamePoint = {
  /** 1-based number of the point over the whole game. */
  point: number;
  /** 1-based number of the set the point belongs to. */
  set: number;
  /** Which player won the point. */
  scoredBy: "W" | "L";
  /** Which player served the point. */
  servedBy: "W" | "L";
  /**
   * Seconds since the previous point of the same set, or null for the first
   * point of a set. That first gap is the break before the set, not the pace
   * of the game.
   */
  seconds: number | null;
};

/**
 * Every point of the game in the order it was scored: who won it, who served
 * it, and how long it took. The server of a point follows from who served
 * first in the set and the score at that point, the same rule the live serve
 * tracker shows.
 */
export function gamePoints(pointSequences: string[], tracking: GameTracking): GamePoint[] {
  const points: GamePoint[] = [];

  pointSequences.forEach((sequence, setIndex) => {
    const deltas = tracking.pointDeltas[setIndex] ?? [];
    // The game winner is slot 1 here, so the set score is counted their way.
    const firstServer: Server = tracking.firstServers[setIndex] === "W" ? 1 : 2;
    let winnerPoints = 0;
    let loserPoints = 0;

    sequence.split("").forEach((point, pointIndex) => {
      const { server } = getServeInfo({ player1: winnerPoints, player2: loserPoints }, firstServer);
      const scoredBy = point === "W" ? "W" : "L";
      points.push({
        point: points.length + 1,
        set: setIndex + 1,
        scoredBy,
        servedBy: server === 1 ? "W" : "L",
        seconds: pointIndex === 0 ? null : (deltas[pointIndex] ?? 0) / 10,
      });
      if (scoredBy === "W") winnerPoints++;
      else loserPoints++;
    });
  });

  return points;
}

export type ScoreStep = {
  /** Points played in the set so far. 0 is the start of the set. */
  played: number;
  /** The game winner's points in the set after this point. */
  winner: number;
  /** The game loser's points in the set after this point. */
  loser: number;
  /** Who won this point, or null at the start of the set. */
  scoredBy: "W" | "L" | null;
};

export type SetProgression = {
  /** 1-based number of the set. */
  set: number;
  final: { winner: number; loser: number };
  /** True when the game winner also won this set. */
  wonByGameWinner: boolean;
  /** The score of both players after every point, from 0-0 up. */
  steps: ScoreStep[];
};

/**
 * The score of both players through each set, one step per point. The steps
 * start at 0-0, so a set of n points has n + 1 steps.
 */
export function setProgressions(pointSequences: string[]): SetProgression[] {
  return pointSequences.map((sequence, index) => {
    const steps: ScoreStep[] = [{ played: 0, winner: 0, loser: 0, scoredBy: null }];
    let winner = 0;
    let loser = 0;

    for (const point of sequence) {
      if (point === "W") winner++;
      else loser++;
      steps.push({ played: steps.length, winner, loser, scoredBy: point === "W" ? "W" : "L" });
    }

    return { set: index + 1, final: { winner, loser }, wonByGameWinner: winner > loser, steps };
  });
}

export type PointSituation = {
  /** Short name of the situation, for the axis of the chart. */
  label: string;
  /** Which points the situation counts, for the tooltip. */
  description: string;
  /** Percent of the situation's points the game winner won, or null for none. */
  winner: number | null;
  /** Percent of the situation's points the game loser won, or null for none. */
  loser: number | null;
  /** How many points each percent is over. */
  winnerOf: number;
  loserOf: number;
};

/** The percent of a set of points that one player won. */
function wonPercent(points: GamePoint[], side: "W" | "L"): number | null {
  if (points.length === 0) return null;
  return (points.filter((point) => point.scoredBy === side).length / points.length) * 100;
}

/** The middle value of a list of numbers, or null when the list is empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * How each player did in the situations of the game: over all of the points,
 * on each side of the serve, and over the slower and the faster half of the
 * points. Each percent is over the points of that situation, so the two
 * players read on the same 0 to 100 scale.
 *
 * A situation with no points for either player is left out. The two halves of
 * the pace need timed points, which the first point of a set does not have.
 */
export function pointSituations(pointSequences: string[], tracking: GameTracking): PointSituation[] {
  const points = gamePoints(pointSequences, tracking);
  const timed = points.filter((point): point is GamePoint & { seconds: number } => point.seconds !== null);
  const middle = median(timed.map((point) => point.seconds));
  const slower = middle === null ? [] : timed.filter((point) => point.seconds > middle);
  const faster = middle === null ? [] : timed.filter((point) => point.seconds <= middle);

  const situations: { label: string; description: string; winner: GamePoint[]; loser: GamePoint[] }[] = [
    { label: "All points", description: "Every point of the game", winner: points, loser: points },
    {
      label: "Own serve",
      description: "The points the player served",
      winner: points.filter((point) => point.servedBy === "W"),
      loser: points.filter((point) => point.servedBy === "L"),
    },
    {
      label: "Their serve",
      description: "The points the opponent served",
      winner: points.filter((point) => point.servedBy === "L"),
      loser: points.filter((point) => point.servedBy === "W"),
    },
    { label: "Long points", description: "The slower half of the points", winner: slower, loser: slower },
    { label: "Short points", description: "The faster half of the points", winner: faster, loser: faster },
  ];

  return situations
    .filter((situation) => situation.winner.length > 0 && situation.loser.length > 0)
    .map((situation) => ({
      label: situation.label,
      description: situation.description,
      winner: wonPercent(situation.winner, "W"),
      loser: wonPercent(situation.loser, "L"),
      winnerOf: situation.winner.length,
      loserOf: situation.loser.length,
    }));
}

export type ServeStats = {
  /** Points played on this player's serve, and how many of them the player won. */
  winner: { served: number; won: number };
  loser: { served: number; won: number };
};

/** Counts how each player did on the points they served themselves. */
export function serveStats(pointSequences: string[], tracking: GameTracking): ServeStats {
  const stats: ServeStats = { winner: { served: 0, won: 0 }, loser: { served: 0, won: 0 } };

  for (const point of gamePoints(pointSequences, tracking)) {
    const side = point.servedBy === "W" ? stats.winner : stats.loser;
    side.served++;
    if (point.scoredBy === point.servedBy) side.won++;
  }

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
