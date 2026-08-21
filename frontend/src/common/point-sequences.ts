/**
 * Point-by-point tracking during a live game.
 *
 * While a game is tracked the winner is unknown, so points are collected per
 * set as a string of "1"/"2" chars — one char per point, in the order the
 * points were scored, naming the player slot that won the point. Next to each
 * sequence the tracker keeps the time of every point, and per set who served
 * first. When the game is saved all of it is re-encoded from the game winner's
 * perspective ("W"/"L") to match how a GAME_SCORE event stores its setPoints.
 * The side of the table travels separately, on the setPoints entries — see
 * `gameWinnerSideOfBadSide`.
 */

import { GameTracking } from "../client/client-db/event-store/event-types";
import { Server } from "./serve-tracker";

export type TrackedSetPoints = { player1: number; player2: number };

/** A tracked set: the points in scoring order, and when each one was scored. */
export type TrackedSet = {
  sequence: string;
  /** Epoch ms of each point, parallel to `sequence`. */
  pointTimes: number[];
};

export const emptyTrackedSet: TrackedSet = { sequence: "", pointTimes: [] };

/**
 * Epoch ms from a clock that cannot jump backwards inside one page load. A
 * system clock correction while a game is tracked would otherwise shift the
 * point times, or make them run backwards. Across a page reload this
 * re-anchors on the system clock, which is the best available.
 */
export function trackingNow(): number {
  if (typeof performance !== "undefined" && typeof performance.timeOrigin === "number") {
    return Math.round(performance.timeOrigin + performance.now());
  }
  return Date.now();
}

export function appendPoint(set: TrackedSet, player: 1 | 2, at: number): TrackedSet {
  return { sequence: set.sequence + String(player), pointTimes: [...set.pointTimes, at] };
}

/**
 * Undo one point for a player: drops that player's last point from the set,
 * keeping the points scored after it and their times. The surviving points
 * keep the time they were scored at, so the timeline stays true.
 */
export function removeLastPoint(set: TrackedSet, player: 1 | 2): TrackedSet {
  const index = set.sequence.lastIndexOf(String(player));
  if (index === -1) return set;
  return {
    sequence: set.sequence.slice(0, index) + set.sequence.slice(index + 1),
    pointTimes: [...set.pointTimes.slice(0, index), ...set.pointTimes.slice(index + 1)],
  };
}

function sequenceMatchesSet(sequence: string, set: TrackedSetPoints): boolean {
  const player1Points = sequence.split("").filter((point) => point === "1").length;
  const player2Points = sequence.length - player1Points;
  return player1Points === set.player1 && player2Points === set.player2;
}

/**
 * Re-encodes what a tracker collected into the `pointSequences` and `tracking`
 * of a GAME_SCORE event. The two always travel together, so this builds both
 * or neither.
 *
 * Returns undefined when the tracked data does not line up with the completed
 * sets — e.g. a broadcasted live game that started before this tracking
 * existed — so the game is saved without point-level data instead of failing
 * validation.
 */
export function toEventTrackingData(params: {
  completedSets: TrackedSetPoints[];
  trackedSets: TrackedSet[];
  /** Who served the first point of each completed set. */
  firstServers: Server[];
  player1IsGameWinner: boolean;
  source: GameTracking["source"];
  /** Epoch ms tracking started, and when the match was ended. */
  startedAt: number | null;
  endedAt: number | null;
  corrections: number;
}): { pointSequences: string[]; tracking: GameTracking } | undefined {
  const { completedSets, trackedSets, firstServers, player1IsGameWinner, startedAt, endedAt } = params;
  if (startedAt === null || endedAt === null) return undefined;
  if (completedSets.length === 0) return undefined;
  if (trackedSets.length !== completedSets.length) return undefined;
  if (firstServers.length !== completedSets.length) return undefined;
  if (trackedSets.some((set, index) => sequenceMatchesSet(set.sequence, completedSets[index]) === false)) {
    return undefined;
  }
  if (trackedSets.some((set) => set.sequence.length !== set.pointTimes.length)) return undefined;

  const gameWinnerSlot: Server = player1IsGameWinner ? 1 : 2;
  const pointSequences = trackedSets.map((set) =>
    set.sequence
      .split("")
      .map((point) => (Number(point) === gameWinnerSlot ? "W" : "L"))
      .join(""),
  );

  // Each delta is the difference of two rounded offsets from the start, not the
  // rounding of one gap. That keeps the deltas in step with the total instead
  // of drifting away from it point by point. The clamp keeps them positive
  // even if a point time went backwards.
  let previousTenths = 0;
  const pointDeltas = trackedSets.map((set) =>
    set.pointTimes.map((time) => {
      const tenths = Math.max(previousTenths, Math.round((time - startedAt) / 100));
      const delta = tenths - previousTenths;
      previousTenths = tenths;
      return delta;
    }),
  );

  return {
    pointSequences,
    tracking: {
      version: 1,
      source: params.source,
      startedAt,
      pointDeltas,
      endedAfter: Math.max(0, Math.round((endedAt - startedAt) / 100) - previousTenths),
      firstServers: firstServers.map((server) => (server === gameWinnerSlot ? "W" : "L")).join(""),
      corrections: params.corrections,
    },
  };
}
