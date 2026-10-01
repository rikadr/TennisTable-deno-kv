import { Season } from "../../client/client-db/seasons/season";
import { determineSeason } from "../../client/client-db/seasons/seasons";
import { TennisTable } from "../../client/client-db/tennis-table";

export type LeaderboardView = "overall" | "season";

export type DashboardSeasonState = {
  /** Undefined in the off-season, and in a season that has no games yet */
  currentSeason?: Season;
  /** True in the grace period between 2 seasons */
  isOffSeason: boolean;
  /** The season that ended last. Set only in the off-season */
  lastSeason?: Season;
};

export function dashboardSeasonState(context: TennisTable, now: number): DashboardSeasonState {
  const seasons = context.seasons.getSeasons();
  const currentSeason = seasons.find((s) => now >= s.start && now <= s.end);
  const isOffSeason = now > determineSeason(now).end;
  const lastSeason = isOffSeason ? [...seasons].reverse().find((s) => s.end < now) : undefined;
  return { currentSeason, isOffSeason, lastSeason };
}
