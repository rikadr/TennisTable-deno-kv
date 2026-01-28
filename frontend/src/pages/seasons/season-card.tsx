import React from "react";
import { Link } from "react-router-dom";
import { Season } from "../../client/client-db/seasons/season";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";
import { ProfilePicture } from "../player/profile-picture";

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
      <div className="bg-secondary-background rounded-xl p-5 border border-primary-text/10 ring-1 ring-primary-text/20 shadow-sm hover:shadow-md hover:border-primary-text/30 transition-all duration-200">
        <div className="flex flex-col md:flex-row justify-between gap-4">

          {/* Left Side: Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-secondary-text group-hover:text-primary-text transition-colors">
                Season {fmtNum(totalSeasons - index)}
              </h2>
              {isActive && (
                <span className="px-2 py-0.5 rounded-full bg-primary-text/10 text-primary-text text-xs font-medium border border-primary-text/20">
                  Active
                </span>
              )}
              {isUpcoming && (
                <span className="px-2 py-0.5 rounded-full bg-secondary-text/10 text-secondary-text text-xs font-medium border border-secondary-text/20">
                  Upcoming
                </span>
              )}
            </div>

            <div className="text-sm text-secondary-text/80 space-y-1">
              <div className="flex items-center gap-2">
                <span>📅</span>
                <span>{dateString(start)} — {dateString(end)}</span>
              </div>
              <div className="flex items-center gap-2">
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
          <div className="flex flex-col items-start md:items-end gap-4 min-w-[200px]">
            <div className="flex gap-6">
              <div className="text-center md:text-right">
                <div className="text-lg font-bold text-secondary-text">{participantCount}</div>
                <div className="text-xs text-secondary-text/60">Players</div>
              </div>
            </div>

            {winnerId && (
              <div className="flex items-center gap-3 bg-primary-background px-4 py-2 rounded-lg w-full md:w-auto">
                <div className="text-2xl">🏆</div>
                <div>
                  <div className="text-xs text-primary-text/50 font-medium uppercase tracking-wider">Winner</div>
                  <div className="flex items-center gap-2">
                    <ProfilePicture playerId={winnerId} size={24} border={1} />
                    <span className="font-bold text-secondary-text">{context.playerName(winnerId)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
