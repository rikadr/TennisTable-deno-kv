import { achievementProgressPercentage } from "../../common/achievement-progress";
import { TennisTable } from "../../client/client-db/tennis-table";

export type ProgressRow = {
  player: TennisTable["allPlayers"][number];
  isRetired: boolean;
  current: number;
  target: number;
  percent: number;
  earned: number;
  /**
   * The full career count, for an achievement that counts past its target.
   * `current` stops at the target, so it cannot rank the holders.
   */
  total?: number;
};

/**
 * Every player's progress towards one achievement, best first. Retired players
 * are included — their progress history is as real as anyone's — and tagged as
 * retired, so a list can mark them.
 *
 * Used by the everyone's progress list and by the details view, which shows
 * only the players closest to earning it.
 */
export function playersProgressForType(context: TennisTable, type: string): ProgressRow[] {
  const activeIds = new Set(context.players.map((player) => player.id));

  return context.allPlayers
    .map((player) => {
      const progression = context.achievements.getPlayerProgression(player.id);
      const specificProgression = progression[type as keyof typeof progression];

      // Safely extract current and target if they exist. Some progression
      // shapes have no target (record chases before a record exists), so
      // narrowed values still need an undefined fallback.
      let current = 0;
      let target = 0;
      let percent = 0;
      let earned = 0;
      let total: number | undefined = undefined;

      if (specificProgression && "earned" in specificProgression) {
        earned = specificProgression.earned ?? 0;
      }

      if (specificProgression && "target" in specificProgression && "current" in specificProgression) {
        current = specificProgression.current ?? 0;
        target = specificProgression.target ?? 0;
      } else if (specificProgression && "earned" in specificProgression) {
        current = earned;
        // An achievement with no target only counts earnings. Treating 1 as the
        // target keeps the row out of the progress bar branch of the list.
        target = 1;
      }

      if (specificProgression && "total" in specificProgression) {
        total = specificProgression.total;
      }

      if (target > 0) {
        percent = Math.round(achievementProgressPercentage(type, current, target));
      }

      return { player, isRetired: !activeIds.has(player.id), current, target, percent, earned, total };
    })
    .sort((a, b) => {
      // Sort by percent desc, then by current value desc. On a tie an active
      // player comes before a retired player.
      if (b.percent !== a.percent) return b.percent - a.percent;
      if (b.current !== a.current) return b.current - a.current;
      return Number(a.isRetired) - Number(b.isRetired);
    });
}

export type CareerCountRow = {
  player: ProgressRow["player"];
  total: number;
  /** 1 is the highest count. Players with the same count share a rank. */
  rank: number;
};

/**
 * The holders of an achievement with the highest career counts, highest first.
 * Only a player who earned the achievement is in the list, so the list is
 * shorter than `limit` when fewer players hold it. Empty for an achievement
 * that has no career count.
 */
export function topCareerCounts(rows: ProgressRow[], limit: number): CareerCountRow[] {
  const holders = rows
    .flatMap((row) => (row.earned > 0 && row.total !== undefined ? [{ player: row.player, total: row.total }] : []))
    .sort((a, b) => b.total - a.total);

  return holders
    .map((holder) => ({ ...holder, rank: holders.findIndex((other) => other.total === holder.total) + 1 }))
    .slice(0, limit);
}
