import React from "react";
import { Link } from "react-router-dom";
import { Achievement } from "../../client/client-db/achievements";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ACHIEVEMENT_LABELS, dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";
import { ProfilePicture } from "../player/profile-picture";

interface AchievementsListProps {
  achievements: Achievement[];
}

export const AchievementsList: React.FC<AchievementsListProps> = ({ achievements }) => {
  const context = useEventDbContext();

  if (achievements.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🏆</div>
        <p>No achievements yet</p>
        <p className="text-sm/70 mt-2">Keep playing to unlock achievements!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {achievements.map((achievement, index) => {
        const label = ACHIEVEMENT_LABELS[achievement.type] || {
          title: achievement.type,
          description: "",
          icon: "🏅",
        };

        return (
          <div
            key={`${achievement.type}-${achievement.earnedBy}-${achievement.earnedAt}-${index}`}
            className="rounded-lg p-3 max-w-2xl border bg-background-secondary border-primary-text/30 hover:border-accent/50 transition-colors text-primary-text"
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl shrink-0">{label.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2 overflow-hidden">
                    <h3 className="font-semibold text-primary-text whitespace-nowrap">{label.title}</h3>
                    <p className="text-xs opacity-70 truncate hidden sm:block">{label.description}</p>
                  </div>
                  <div className="text-[10px] whitespace-nowrap opacity-60 text-right shrink-0">
                    <p>{dateString(achievement.earnedAt)}</p>
                    <p>{relativeTimeString(new Date(achievement.earnedAt))}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <div
                    className="rounded-full w-fit flex items-center bg-primary-background/50 ring-1 ring-primary-text/10"
                  >
                    <Link
                      to={"/player/" + achievement.earnedBy}
                      className="flex gap-2 items-center pr-3 p-0.5 "
                    >
                      <ProfilePicture playerId={achievement.earnedBy} size={18} border={1} />
                      <span className="text-xs font-medium">
                        {context.playerName(achievement.earnedBy)}
                      </span>
                    </Link>
                  </div>

                  {achievement.data && "opponent" in achievement.data && (
                    <span className="text-[11px] opacity-80">
                      vs {context.playerName(achievement.data.opponent)}
                    </span>
                  )}
                  {achievement.data && "tournamentId" in achievement.data && (
                    <span className="text-[11px] opacity-80">
                      🏆 {context.tournaments.getTournament(
                        achievement.data.tournamentId
                      )?.tournamentDb.name || "Tournament"}
                    </span>
                  )}
                  {achievement.data &&
                    "opponents" in achievement.data &&
                    achievement.data.opponents && (
                      <div className="text-[11px] opacity-80">
                        Welcomed:{" "}
                        {achievement.data.opponents
                          .map((player: string) => context.playerName(player))
                          .join(", ")}
                      </div>
                    )}
                  {achievement.data && "firstGameInPeriod" in achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {dateString(achievement.data.firstGameInPeriod)} – {dateString(achievement.earnedAt)}
                    </span>
                  )}
                  {achievement.data && "startedAt" in achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {dateString(achievement.data.startedAt)} – {dateString(achievement.earnedAt)}
                    </span>
                  )}
                  {achievement.data && "seasonStart" in achievement.data && (
                    <span className="text-[11px] opacity-80">
                      Season: {dateString(achievement.data.seasonStart)} – {dateString(achievement.earnedAt)}
                    </span>
                  )}
                  {achievement.data && "lastGameAt" in achievement.data && (
                    <span className="text-[11px] opacity-80">
                      {dateString(achievement.data.lastGameAt)} – {dateString(achievement.earnedAt)}
                    </span>
                  )}
                  {achievement.data &&
                    "firstWinAt" in achievement.data &&
                    "thirdWinAt" in achievement.data && (
                      <span className="text-[11px] opacity-80">
                        {Math.round((achievement.data.thirdWinAt - achievement.data.firstWinAt) / (60 * 1000))}m interval
                      </span>
                    )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
