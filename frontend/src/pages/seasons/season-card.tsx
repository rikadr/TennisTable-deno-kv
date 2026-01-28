import React from "react";
import { Link } from "react-router-dom";
import { Season } from "../../client/client-db/seasons/season";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";
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
  let participantCount = 0;

  const leaderboard = season.getLeaderboard();
  if (leaderboard.length > 0) {
    participantCount = leaderboard.length;
    if (hasEnded) {
      winnerId = leaderboard[0].playerId;
    }
  }

  return (
    <Link
      to={`/season?seasonStart=${start}`}
      className="block group"
    >
      <div className="bg-secondary-background rounded-xl p-3 md:p-5 border border-primary-text/10 ring-1 ring-primary-text/20 shadow-sm hover:shadow-md hover:border-primary-text/30 transition-all duration-200">
        <div className="flex flex-row justify-between gap-2 md:gap-4">

          {/* Left Side: Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
              <h2 className="text-base md:text-xl font-bold text-secondary-text group-hover:text-primary-text transition-colors">
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

            <div className="text-xs md:text-sm text-secondary-text/80 space-y-0 md:space-y-1">
              <div className="flex items-center gap-1 md:gap-2">
                <span>📅</span>
                <span>{dateString(start)} — {dateString(end)}</span>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <span>⏱️</span>
                <span>
                  {hasEnded
                    ? `Ended ${relativeTimeString(new Date(end)).toLowerCase()}`
                    : isActive
                      ? `Ends ${relativeTimeString(new Date(end)).toLowerCase()}`
                      : `Starts ${relativeTimeString(new Date(start)).toLowerCase()}`
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Stats & Winner */}
          <div className="flex flex-col items-end gap-1 md:gap-2">
            <div className="text-right">
              <div className="text-base md:text-lg font-bold text-secondary-text">{participantCount}</div>
              <div className="text-xs text-secondary-text/60">Players</div>
            </div>

            {winnerId && (
              <div className="flex items-center gap-1.5 md:gap-2 bg-primary-background px-2 md:px-3 py-1 md:py-1.5 rounded-lg">
                <span className="text-base md:text-xl">🏆</span>
                <ProfilePicture playerId={winnerId} size={20} border={1} />
                <span className="font-bold text-secondary-text text-xs md:text-sm truncate max-w-[80px] md:max-w-none">{context.playerName(winnerId)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
