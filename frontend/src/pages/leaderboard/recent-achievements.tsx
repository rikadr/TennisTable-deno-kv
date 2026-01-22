import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { ACHIEVEMENT_LABELS } from "../player/player-achievements";
import { RelativeTime } from "../../common/date-utils";

export const RecentAchievements: React.FC = () => {
  const context = useEventDbContext();
  
  useEffect(() => {
    // Ensure achievements are calculated
    context.achievements.calculateAchievements();
  }, [context.achievements]);

  // Aggregate all achievements
  const allAchievements = Array.from(context.achievements.achievementMap.values())
    .flat()
    .sort((a, b) => b.earnedAt - a.earnedAt)
    .slice(0, 5);

  if (allAchievements.length === 0) {
    return null;
  }

  return (
    <div className="bg-primary-background rounded-lg ">
      <h1 className="text-2xl text-center mb-4 mt-[27.5px] text-primary-text">Recent achievements</h1>
      <div className="flex flex-col divide-y divide-primary-text/50 text-primary-text">
        <div className="flex gap-4 text-base text-center mb-2">
          <div className="w-24 pl-5">Player</div>
          <div className="w-40 text-left pl-2">Achievement</div>
          <div className="w-28 text-right pr-2">Date</div>
        </div>
        {allAchievements.map((achievement, index) => {
          const label = ACHIEVEMENT_LABELS[achievement.type] || {
            title: achievement.type,
            description: "",
            icon: "🏅",
          };

          return (
            <Link
              key={`${achievement.earnedBy}-${achievement.earnedAt}-${index}`}
              to={`/player/${achievement.earnedBy}?tab=achievements`}
              className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text py-1 px-2 flex gap-4 text-xl font-light items-center"
            >
              <div className="w-24 shrink-0 font-normal whitespace-nowrap flex items-center gap-2">
                <ProfilePicture playerId={achievement.earnedBy} size={28} border={2} />
                <span className="text-base truncate">{context.playerName(achievement.earnedBy)}</span>
              </div>
              <div className="w-40 grow flex items-center gap-2 overflow-hidden">
                <span className="text-2xl">{label.icon}</span>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-normal truncate">{label.title}</span>
                </div>
              </div>
              <div className="w-28 shrink-0 text-right text-base">
                <RelativeTime date={new Date(achievement.earnedAt)} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
