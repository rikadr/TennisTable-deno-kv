// Progress-bar baselines for achievements whose "current" value starts from a
// floor that every player already stands on. Measuring such a chase from 0
// wildly overstates how close a player is.
//
// Marathon Set compares winning scores from true-deuce sets: 11 is an ordinary
// set win, and the chase only begins at 12. A player whose best deuce set was
// 13, needing 16 to beat the league record of 15, is 2 points into a 5-point
// gap — 40%, not 13/16 = 81%. So the bar measures from 11 instead of 0.
const PROGRESS_BASELINES: Record<string, number> = {
  "marathon-set": 11,
};

/**
 * Percentage (0-100) to render for an achievement's progress bar, measured
 * from the achievement's baseline rather than always from 0. Returns 0 when
 * there is nothing to measure (no current value, or no target set yet).
 */
export function achievementProgressPercentage(
  type: string,
  current: number | undefined,
  target: number | undefined,
): number {
  if (!current || !target) return 0;

  const baseline = PROGRESS_BASELINES[type] ?? 0;

  // A target at or below the baseline leaves no span to measure across, so
  // it's all-or-nothing: reaching the target is done, anything less is 0.
  if (target <= baseline) return current >= target ? 100 : 0;

  // Below the baseline the chase hasn't started yet.
  if (current <= baseline) return 0;

  return Math.min(((current - baseline) / (target - baseline)) * 100, 100);
}
