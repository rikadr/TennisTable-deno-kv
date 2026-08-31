import React from "react";
import { Link } from "react-router-dom";
import { Season } from "../../client/client-db/seasons/season";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { dateString, relativeTimeString, relativeTimeStringShort } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";
import { ProfilePicture } from "../player/profile-picture";
import { Shimmer } from "../../common/shimmer";

interface SeasonCardProps {
  season: Season;
  index: number;
  totalSeasons: number;
}

export const SeasonCard: React.FC<SeasonCardProps> = ({ season, index, totalSeasons }) => {
  const context = useEventDbContext();
  const { start, end } = season;
  const hasEnded = Date.now() > end;
  const isActive = !hasEnded && Date.now() > start;
  const isUpcoming = Date.now() < start;

  let winnerId: string | undefined;
  let winnerScore: number | undefined;
  let participantCount = 0;

  const leaderboard = season.getLeaderboard();
  if (leaderboard.length > 0) {
    participantCount = leaderboard.length;
    if (hasEnded) {
      winnerId = leaderboard[0].playerId;
      winnerScore = leaderboard[0].seasonScore;
    }
  }

  // Compact day + month for the mobile date range; the full dates render on
  // md and up.
  const shortDate = (time: number) => new Date(time).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });

  const statusDate = hasEnded || isActive ? new Date(end) : new Date(start);
  const statusVerb = hasEnded ? "Ended" : isActive ? "Ends" : "Starts";

  return (
    <Link to={`/season?seasonStart=${start}`} className="block group">
      <div className="bg-secondary-background rounded-xl px-3 py-2 md:px-5 md:py-3 border border-primary-text/10 ring-1 ring-primary-text/20 shadow-sm hover:shadow-md hover:border-primary-text/30 transition-all duration-200">
        {/* Row 1: Season name + state badge, player count on the right */}
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <h2 className="text-base md:text-xl font-bold text-secondary-text group-hover:text-primary-text transition-colors whitespace-nowrap">
              Season {fmtNum(totalSeasons - index)}
            </h2>
            {isActive && (
              <Shimmer className="rounded-full">
                <div className="px-1.5 md:px-2 py-0.5 bg-primary-background text-primary-text text-xs font-medium">
                  Active
                </div>
              </Shimmer>
            )}
            {isUpcoming && (
              <span className="px-1.5 md:px-2 py-0.5 rounded-full bg-secondary-text/10 text-secondary-text text-xs font-medium border border-secondary-text/20">
                Upcoming
              </span>
            )}
          </div>
          {participantCount > 0 && (
            <div className="whitespace-nowrap">
              <span className="text-sm md:text-lg font-bold text-secondary-text">{participantCount}</span>{" "}
              <span className="text-xs text-secondary-text/60">players</span>
            </div>
          )}
        </div>

        {/* Row 2: dates + status, winner badge on the right */}
        <div className="flex items-center justify-between gap-2 md:gap-4 mt-1">
          <div className="text-xs md:text-sm text-secondary-text/80 min-w-0">
            <span className="md:hidden">
              📅 {shortDate(start)} – {shortDate(end)} · {statusVerb} {relativeTimeStringShort(statusDate)}
            </span>
            <span className="hidden md:inline">
              📅 {dateString(start)} — {dateString(end)} · {statusVerb} {relativeTimeString(statusDate).toLowerCase()}
            </span>
          </div>

          {winnerId && (
            <div className="flex items-center gap-1.5 md:gap-2 bg-primary-background px-2 md:px-3 py-0.5 md:py-1 rounded-lg shrink-0">
              <span className="text-base md:text-xl">🏆</span>
              <ProfilePicture playerId={winnerId} size={20} border={1} />
              <span className="font-bold text-primary-text text-xs md:text-sm truncate max-w-[80px] md:max-w-none">
                {context.playerName(winnerId)}
              </span>
              {winnerScore !== undefined && (
                <span className="text-primary-text/70 text-xs md:text-sm whitespace-nowrap">
                  {fmtNum(winnerScore)} pts
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};
