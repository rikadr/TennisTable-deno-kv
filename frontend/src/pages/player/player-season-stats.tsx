import React from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";
import { ContentCard } from "./player-page";
import { Season } from "../../client/client-db/seasons/season";
import { dateString } from "./player-achievements";
import { SeasonPlayerScoreGraph } from "./season-player-score-graph";

interface PlayerSeasonStatsProps {
  playerId: string;
}

// Moved outside to prevent re-declaration on every render
const SeasonRow = ({
  season,
  stats,
  isCurrent,
  seasonName,
}: {
  season: Season;
  stats: {
    rank: number;
    totalPlayers: number;
    seasonScore: number;
  };
  isCurrent?: boolean;
  seasonName: string;
}) => {
  let medal = null;
  let containerClassName =
    "flex flex-col sm:flex-row gap-4 sm:gap-0 sm:items-center sm:justify-between p-4 bg-primary-background rounded-lg hover:bg-secondary-background/10 transition-colors cursor-pointer border border-transparent ring-1 ring-primary-text/10";

  if (!isCurrent) {
    if (stats.rank === 1) {
      medal = "🥇";
      containerClassName =
        "flex flex-col sm:flex-row gap-4 sm:gap-0 sm:items-center sm:justify-between p-4 bg-gradient-to-r from-yellow-500/20 to-primary-background rounded-lg hover:bg-secondary-background/10 transition-colors cursor-pointer border border-yellow-500/50 shadow-sm ring-1 ring-primary-text/10";
    } else if (stats.rank === 2) {
      medal = "🥈";
    } else if (stats.rank === 3) {
      medal = "🥉";
    }
  }

  return (
    <div className={containerClassName}>
      <div className="flex flex-col">
        <span className="font-bold text-lg">{seasonName}</span>
        <span className="text-sm font-light opacity-80">
          {dateString(season.start)} - {dateString(season.end)}
        </span>
      </div>

      <div className="flex w-full sm:w-auto justify-between sm:justify-end gap-4 md:gap-8 text-right">
        <div className="flex flex-col items-start sm:items-end">
          <span className="text-xs uppercase opacity-70">Rank</span>
          <span className="font-bold text-xl flex items-center">
            {medal && <span className="mr-2 text-2xl">{medal}</span>} #{stats.rank}{" "}
            <span className="text-sm font-normal text-gray-400">
              / {stats.totalPlayers}
            </span>
          </span>
        </div>
        <div className="flex flex-col items-end w-20">
          <span className="text-xs uppercase opacity-70">Points</span>
          <span className="font-bold text-xl">{fmtNum(stats.seasonScore)}</span>
        </div>
      </div>
    </div>
  );
};

export const PlayerSeasonStats: React.FC<PlayerSeasonStatsProps> = ({ playerId }) => {
  const context = useEventDbContext();
  const seasons = context.seasons.getSeasons();

  const now = Date.now();
  const currentSeason = seasons.find((s) => now >= s.start && now <= s.end);

  // Helper to get player stats for a season
  const getPlayerSeasonStats = (season: Season) => {
    const leaderboard = season.getLeaderboard();
    const rankIndex = leaderboard.findIndex((p) => p.playerId === playerId);
    if (rankIndex === -1) return null;

    const stats = leaderboard[rankIndex];
    return {
      rank: rankIndex + 1,
      totalPlayers: leaderboard.length,
      ...stats,
    };
  };

  const currentSeasonStats = currentSeason ? getPlayerSeasonStats(currentSeason) : null;

  // Filter past seasons where player participated
  // Map includes the index from the original seasons array to name them correctly
  const pastSeasons = seasons
    .map((season, index) => ({ season, stats: getPlayerSeasonStats(season), seasonNumber: index + 1 }))
    .filter(
      (item): item is { season: Season; stats: NonNullable<ReturnType<typeof getPlayerSeasonStats>>; seasonNumber: number } =>
        item.season !== currentSeason && item.season.end < now && item.stats !== null,
    )
    .reverse(); // Most recent first

  return (
    <div className="space-y-6">
      {/* Current Season Section */}
      {currentSeason && (
        <ContentCard title="Current Season">
          {currentSeasonStats ? (
            <div className="flex flex-col gap-4">
              <Link to={`/season?seasonStart=${currentSeason.start}`} className="block group">
                <SeasonRow 
                    season={currentSeason} 
                    stats={currentSeasonStats} 
                    isCurrent 
                    seasonName={`Season ${seasons.indexOf(currentSeason) + 1}`} 
                />
              </Link>
              <div className="bg-primary-background rounded-lg -mx-2">
                 <SeasonPlayerScoreGraph season={currentSeason} playerId={playerId} />
              </div>
              <div className="text-right">
                <Link
                  to={`/season/player?seasonStart=${currentSeason.start}&playerId=${playerId}`}
                  className="inline-block px-4 py-2 bg-secondary-background text-secondary-text rounded hover:bg-secondary-background/80 transition"
                >
                  View Full Stats →
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 opacity-70">Player has not participated in the current season yet.</div>
          )}
        </ContentCard>
      )}

      {/* Past Seasons List */}
      {pastSeasons.length > 0 && (
        <ContentCard title="Past Seasons">
          <div className="flex flex-col gap-2">
            {pastSeasons.map(({ season, stats, seasonNumber }) => (
              <Link key={season.start} to={`/season?seasonStart=${season.start}`} className="block group">
                <SeasonRow season={season} stats={stats} seasonName={`Season ${seasonNumber}`} />
              </Link>
            ))}
          </div>
        </ContentCard>
      )}

      {pastSeasons.length === 0 && !currentSeasonStats && (
        <div className="text-center py-8 text-lg opacity-60">No season history found for this player.</div>
      )}
    </div>
  );
};