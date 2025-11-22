import { TennisTable } from "../tennis-table";
import { Season } from "./season";

export class Seasons {
  private parent: TennisTable;
  private seasonsCache: Season[] | undefined;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  getSeasons(): Season[] {
    if (this.seasonsCache) {
      return this.seasonsCache;
    }

    const seasons: Season[] = [];

    let currentSeason: Season | undefined = undefined;

    for (const game of this.parent.games) {
      // Initialise first season
      if (!currentSeason) {
        currentSeason = new Season(determineSeason(game.playedAt));
      }
      // Start next season
      if (game.playedAt >= currentSeason.end) {
        const gameSeason = determineSeason(game.playedAt);
        if (gameSeason.start === currentSeason.start) {
          // Game is after end but before next. Does not count towards any season
          continue;
        }
        seasons.push(currentSeason);
        currentSeason = new Season(gameSeason);
      }

      currentSeason.addGame(game);
    }
    // Add last season
    if (currentSeason) {
      seasons.push(currentSeason);
    }

    this.seasonsCache = seasons;
    return seasons;
  }

  clearCache() {
    this.seasonsCache = undefined;
  }
}

/** Returns start and end time of the season that the provided time stamp belongs to
 * Seasons start on first Monday of the month at 10:00.
 * Seasons end on the Friday at 17:00, 10 days before the next season starts.
 * A provided time within the 10 day period will return the season that just ended.
 */
export function determineSeason(time: number): { start: number; end: number } {
  // Split year into 4 quarters.
  // Round time down to nearest quarter time.
  const date = new Date(time);
  const year = date.getFullYear();
  const month = date.getMonth();

  // Round down to nearest quarter start month (0, 3, 6, 9)
  const seasonStartMonth = Math.floor(month / 3) * 3;

  // Find the first Monday of the season start month
  const firstOfMonth = new Date(year, seasonStartMonth, 1);
  const dayOfWeek = firstOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate days until next Monday (if not already Monday)
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const seasonStart = new Date(year, seasonStartMonth, 1 + daysUntilMonday, 10, 0, 0, 0).getTime();

  // Find the first Monday of the next season
  const nextSeasonFirstOfMonth = new Date(year, seasonStartMonth + 3, 1);
  const nextDayOfWeek = nextSeasonFirstOfMonth.getDay();
  const nextDaysUntilMonday = nextDayOfWeek === 0 ? 1 : nextDayOfWeek === 1 ? 0 : 8 - nextDayOfWeek;
  const nextSeasonStart = new Date(year, seasonStartMonth + 3, 1 + nextDaysUntilMonday, 10, 0, 0, 0).getTime();

  // Season ends on Friday, 10 days before next season starts, at 17:00
  const seasonEnd = nextSeasonStart - 10 * 24 * 60 * 60 * 1000;
  const seasonEndDate = new Date(seasonEnd);
  seasonEndDate.setHours(17, 0, 0, 0);

  return { start: seasonStart, end: seasonEndDate.getTime() };
}
