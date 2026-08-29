import { HallOfFameFactorKey } from "../../client/client-db/hall-of-fame";
import { HallOfFameHistoryPoint } from "../../client/client-db/hall-of-fame-history";

/** One point of the delta graph: the points each section gained in the period
 * that ends at the point.
 *
 * The gain of each section is on the point itself, because the graph stacks
 * one area per section key, exactly like the cumulative graph. */
export type DeltaPoint = {
  /** End of the period. The point is labeled by this timestamp. */
  time: number;
  /** Start of the period, which is the previous point. The first point is the
   * day the player joined and has no period before it. */
  from?: number;
  /** The total score after the period. */
  cumulative: number;
  /** Points gained on the total score in the period. Negative when the score
   * dropped. */
  total: number;
} & Record<HallOfFameFactorKey, number>;

/** Converts each point to the gain of each section since the previous point.
 *
 * The gains add up to the score of the last point. The first point is the day
 * the player joined; it gets 0 for every section, so the delta graph starts on
 * the same day as the cumulative graph. */
export function deltaPoints(points: HallOfFameHistoryPoint[]): DeltaPoint[] {
  return points.map((point, i) => {
    const previous = i === 0 ? point : points[i - 1];

    const gains = {} as Record<HallOfFameFactorKey, number>;
    for (const key of Object.keys(point.factors) as HallOfFameFactorKey[]) {
      gains[key] = point.factors[key] - previous.factors[key];
    }

    return {
      time: point.time,
      from: i === 0 ? undefined : previous.time,
      cumulative: point.total,
      total: point.total - previous.total,
      ...gains,
    };
  });
}
