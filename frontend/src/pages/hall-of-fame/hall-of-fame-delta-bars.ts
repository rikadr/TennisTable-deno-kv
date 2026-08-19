/** Most bars in the delta view. The simulation makes up to 100 points, and 99
 * bars is too fine to read, so consecutive periods are grouped into one bar. */
export const MAX_DELTA_BARS = 25;

export type ScorePoint = { time: number; cumulative: number; delta: number };

export type DeltaBar = {
  /** End of the period. The bar is labeled by this timestamp. */
  time: number;
  /** Start of the period, which is the end of the previous bar. */
  from: number;
  /** The score after the period. */
  cumulative: number;
  /** Points gained in the period. Negative when the score dropped. */
  delta: number;
};

/** Groups the score points into at most `MAX_DELTA_BARS` periods.
 *
 * The gain of a period is the sum of the gains of the points it covers, so the
 * bars still add up to the score of the last point. The first point is the day
 * the player joined and has no period before it, so it gets no bar. */
export function deltaBars(points: ScorePoint[]): DeltaBar[] {
  if (points.length < 2) return [];

  const periods = points.slice(1);
  const groupSize = Math.ceil(periods.length / MAX_DELTA_BARS);
  const bars: DeltaBar[] = [];

  for (let i = 0; i < periods.length; i += groupSize) {
    const group = periods.slice(i, i + groupSize);
    const last = group[group.length - 1];
    bars.push({
      time: last.time,
      from: points[i].time,
      cumulative: last.cumulative,
      delta: group.reduce((sum, period) => sum + period.delta, 0),
    });
  }

  return bars;
}
