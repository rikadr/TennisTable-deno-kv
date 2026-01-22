import { useEventDbContext } from "../../wrappers/event-db-context";
import { SeasonCard } from "./season-card";

export function SeasonsListPage() {
  const context = useEventDbContext();
  const seasons = context.seasons.getSeasons();
  const reversedSeasons = seasons.toReversed();

  const activeSeasonIndex = reversedSeasons.findIndex((s) => {
    const now = Date.now();
    return now >= s.start && now <= s.end;
  });

  const activeSeason = activeSeasonIndex !== -1 ? reversedSeasons[activeSeasonIndex] : undefined;

  const archiveList =
    activeSeasonIndex !== -1 ? reversedSeasons.filter((_, idx) => idx !== activeSeasonIndex) : reversedSeasons;

  return (
    <div className="p-4 md:p-8 bg-primary-background min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col space-y-8">
          {activeSeason && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary-text">Current Season</h2>
              <SeasonCard season={activeSeason} index={activeSeasonIndex} totalSeasons={seasons.length} />
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-primary-text">Seasons Archive</h2>
            <div className="flex flex-col space-y-4">
              {archiveList.map((season) => {
                const originalIndex = reversedSeasons.indexOf(season);
                return (
                  <SeasonCard
                    key={season.start}
                    season={season}
                    index={originalIndex}
                    totalSeasons={seasons.length}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
