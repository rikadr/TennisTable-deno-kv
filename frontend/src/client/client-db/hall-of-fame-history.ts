import { ONE_DAY } from "../../common/time-in-ms";
import { eventsUpTo } from "./event-store/events-up-to";
import { HallOfFameFactorKey } from "./hall-of-fame";
import { TennisTable } from "./tennis-table";

/** Most simulated points on the graph. */
export const HISTORY_MAX_POINTS = 100;

/** Shortest time between two simulated points. */
export const HISTORY_MIN_STEP_MS = ONE_DAY;

export type HallOfFameHistoryPoint = {
  time: number;
  total: number;
  factors: Record<HallOfFameFactorKey, number>;
};

export type HallOfFameHistoryResult = {
  playerId: string;
  points: HallOfFameHistoryPoint[];
};

/** The timestamps to simulate the score at.
 *
 * The first point is when the player was created and the last point is `now`.
 * In between the points are evenly spread, never closer than one day and never
 * more than `HISTORY_MAX_POINTS` in total. A short career therefore gets one
 * point per day, and a long career gets 100 points spread over its full span. */
export function hallOfFameHistoryTimes(createdAt: number, now: number): number[] {
  if (now <= createdAt) return [createdAt];

  const span = now - createdAt;
  const step = Math.max(HISTORY_MIN_STEP_MS, span / (HISTORY_MAX_POINTS - 1));

  const times = [createdAt];
  // Only keep a point while a full step still fits before `now`, so the last
  // step (up to `now`) never falls below the minimum distance. The 1 ms
  // tolerance keeps float division from dropping the final even point.
  for (let time = createdAt + step; time <= now - step + 1; time += step) {
    times.push(Math.floor(time));
  }
  times.push(now);

  return times;
}

export class HallOfFameHistory {
  private parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  /** Simulates the player's Hall of Fame score at up to 100 points in time.
   *
   * Each point projects the whole app state as it was at that timestamp and
   * scores the player against it, because the score depends on what everyone
   * else had done by then (Elo, time at the top and achievement records).
   * This is expensive, so it is meant to run in a web worker. */
  computeForPlayer(playerId: string, now: number, onProgress?: (progress: number) => void): HallOfFameHistoryResult {
    const player = this.parent.eventStore.playersProjector.getPlayer(playerId);
    if (!player) return { playerId, points: [] };

    const times = hallOfFameHistoryTimes(player.createdAt, now);
    const points: HallOfFameHistoryPoint[] = [];

    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      const stateAtTime = new TennisTable({
        events: eventsUpTo(this.parent.events, time),
        referenceTime: time,
      });
      const entry = stateAtTime.hallOfFame.getScoreForAnyPlayer(playerId);

      points.push({
        time,
        total: entry?.score.total ?? 0,
        factors: {
          seasonPerformance: entry?.score.seasonPerformance.score ?? 0,
          achievementsEarned: entry?.score.achievementsEarned.score ?? 0,
          socialDiversity: entry?.score.socialDiversity.score ?? 0,
          tournamentProgression: entry?.score.tournamentProgression.score ?? 0,
          longevity: entry?.score.longevity.score ?? 0,
          experience: entry?.score.experience.score ?? 0,
          dataVolume: entry?.score.dataVolume.score ?? 0,
          peakElo: entry?.score.peakElo.score ?? 0,
          podiumTime: entry?.score.podiumTime.score ?? 0,
        },
      });

      onProgress?.((i + 1) / times.length);
    }

    return { playerId, points };
  }
}
