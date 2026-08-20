import { achievementProgressPercentage } from "../../common/achievement-progress";
import { TennisTable } from "../../client/client-db/tennis-table";

export type ProgressRow = {
  player: TennisTable["allPlayers"][number];
  isRetired: boolean;
  current: number;
  target: number;
  percent: number;
  earned: number;
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

      if (target > 0) {
        percent = Math.round(achievementProgressPercentage(type, current, target));
      }

      return { player, isRetired: !activeIds.has(player.id), current, target, percent, earned };
    })
    .sort((a, b) => {
      // Sort by percent desc, then by current value desc
      if (b.percent !== a.percent) return b.percent - a.percent;
      return b.current - a.current;
    });
}
