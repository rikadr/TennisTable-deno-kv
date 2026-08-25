import { HallOfFameFactorKey } from "../../client/client-db/hall-of-fame";
import { HallOfFameHistoryPoint } from "../../client/client-db/hall-of-fame-history";

/** One point of the stacked graph in the relative view.
 *
 * The share of each section is on the point itself, because the graph stacks
 * one area per section key. The scores in points stay available for the
 * tooltip. */
export type StackedSharePoint = {
  time: number;
  /** The score at the point, in points. */
  total: number;
  /** The score of each section at the point, in points. */
  absolute: Record<HallOfFameFactorKey, number>;
} & Record<HallOfFameFactorKey, number>;

/** Converts each point to the share of each section, in percent.
 *
 * The shares of a point add up to 100, so the stacked graph fills the full
 * height and shows how the sections divide the score at that time. A point
 * where the player has no score yet gets 0 for every section. */
export function stackedShares(points: HallOfFameHistoryPoint[]): StackedSharePoint[] {
  return points.map((point) => {
    const keys = Object.keys(point.factors) as HallOfFameFactorKey[];
    const sum = keys.reduce((total, key) => total + point.factors[key], 0);

    const shares = {} as Record<HallOfFameFactorKey, number>;
    for (const key of keys) {
      shares[key] = sum > 0 ? (point.factors[key] / sum) * 100 : 0;
    }

    return { time: point.time, total: point.total, absolute: point.factors, ...shares };
  });
}
