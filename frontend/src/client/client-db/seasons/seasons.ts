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
      const gameSeason = determineSeason(game.playedAt);

      // Only games within the season's start and end count.
      // Games in the grace period between seasons do not count towards any season.
      if (game.playedAt < gameSeason.start || game.playedAt >= gameSeason.end) {
        continue;
      }

      // Start next season
      if (!currentSeason || gameSeason.start !== currentSeason.start) {
        if (currentSeason) {
          seasons.push(currentSeason);
        }
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

  const season = seasonOfQuarter(year, seasonStartMonth);
  if (time >= season.start) {
    return season;
  }

  // Time is before this quarter's season starts, i.e. in the part of the grace
  // period that spills into the new quarter's first month. It belongs to the
  // season that just ended.
  return seasonOfQuarter(year, seasonStartMonth - 3);
}

function seasonOfQuarter(year: number, seasonStartMonth: number): { start: number; end: number } {
  const seasonStart = firstMondayAt10(year, seasonStartMonth);
  const nextSeasonStart = firstMondayAt10(year, seasonStartMonth + 3);

  // Season ends on Friday, 10 days before next season starts, at 17:00
  const seasonEnd = nextSeasonStart - 10 * 24 * 60 * 60 * 1000;
  const seasonEndDate = new Date(seasonEnd);
  seasonEndDate.setHours(17, 0, 0, 0);

  return { start: seasonStart, end: seasonEndDate.getTime() };
}

function firstMondayAt10(year: number, month: number): number {
  const firstOfMonth = new Date(year, month, 1);
  const dayOfWeek = firstOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate days until next Monday (if not already Monday)
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  return new Date(year, month, 1 + daysUntilMonday, 10, 0, 0, 0).getTime();
}
