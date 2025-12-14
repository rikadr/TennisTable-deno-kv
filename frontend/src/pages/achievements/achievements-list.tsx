import React from "react";
import { Link } from "react-router-dom";
import { Achievement } from "../../client/client-db/achievements";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ACHIEVEMENT_LABELS, dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";
import { stringToColor } from "../../common/string-to-color";
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
    <div className="space-y-3">
      {achievements.map((achievement, index) => {
        const label = ACHIEVEMENT_LABELS[achievement.type] || {
          title: achievement.type,
          description: "",
          icon: "🏅",
        };

        return (
          <div
            key={`${achievement.type}-${achievement.earnedBy}-${achievement.earnedAt}-${index}`}
            className="rounded-lg p-4 max-w-2xl border bg-background-secondary border-primary-text hover:border-accent/50 transition-colors text-primary-text"
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">{label.icon}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-primary-text">{label.title}</h3>
                    <p className="text-sm mt-1">{label.description}</p>
                  </div>
                  <div className="text-xs whitespace-nowrap ml-4">
                    <p>{dateString(achievement.earnedAt)}</p>
                    <p>{relativeTimeString(new Date(achievement.earnedAt))}</p>
                  </div>
                </div>
                <div>
                  {achievement.data && "opponent" in achievement.data && (
                    <span className="text-xs">
                      vs {context.playerName(achievement.data.opponent)}
                    </span>
                  )}
                  {achievement.data && "tournamentId" in achievement.data && (
                    <span className="text-xs">
                      Tournament:{" "}
                      {context.tournaments.getTournament(
                        achievement.data.tournamentId
                      )?.tournamentDb.name || "Unknown"}
                    </span>
                  )}
                  {achievement.data &&
                    "opponents" in achievement.data &&
                    achievement.data.opponents && (
                      <div className="mt-2 text-xs">
                        Welcomed:{" "}
                        {achievement.data.opponents
                          .map((player: string) => context.playerName(player))
                          .join(", ")}
                      </div>
                    )}
                  {achievement.data && "firstGameInPeriod" in achievement.data && (
                    <span className="text-xs">
                      From {dateString(achievement.data.firstGameInPeriod)} to{" "}
                      {dateString(achievement.earnedAt)}
                    </span>
                  )}
                  {achievement.data && "startedAt" in achievement.data && (
                    <p className="text-xs mt-2">
                      From {dateString(achievement.data.startedAt)} to{" "}
                      {dateString(achievement.earnedAt)}
                    </p>
                  )}
                  {achievement.data && "seasonStart" in achievement.data && (
                    <p className="text-xs mt-2">
                      Season from {dateString(achievement.data.seasonStart)} to{" "}
                      {dateString(achievement.earnedAt)}
                    </p>
                  )}
                  {achievement.data && "lastGameAt" in achievement.data && (
                    <p className="text-xs mt-2">
                      From {dateString(achievement.data.lastGameAt)} to{" "}
                      {dateString(achievement.earnedAt)}
                    </p>
                  )}
                  {achievement.data &&
                    "firstWinAt" in achievement.data &&
                    "thirdWinAt" in achievement.data && (
                      <p className="text-xs mt-2">
                        From {dateString(achievement.data.firstWinAt)} to{" "}
                        {dateString(achievement.data.thirdWinAt)} (
                        {Math.round(
                          (achievement.data.thirdWinAt -
                            achievement.data.firstWinAt) /
                            (60 * 1000)
                        )}{" "}
                        minutes)
                      </p>
                    )}
                  <div
                    className="rounded-full w-fit mt-2"
                    style={{ background: stringToColor(achievement.earnedBy) }}
                  >
                    <Link
                      to={"/player/" + achievement.earnedBy}
                      className="flex gap-3 items-center pr-4 p-1 "
                    >
                      <ProfilePicture playerId={achievement.earnedBy} size={20} />
                      <span className="text-sm text-accent font-medium">
                        {context.playerName(achievement.earnedBy)}
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
