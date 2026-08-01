import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { ACHIEVEMENT_LABELS } from "../player/player-achievements";
import { RelativeTime } from "../../common/date-utils";
import { useRerender } from "../../hooks/use-rerender";

type Props = {
  view?: "overall" | "season";
};

export const RecentAchievements: React.FC<Props> = ({ view = "overall" }) => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const rerender = useRerender();

  useEffect(() => {
    // Ensure achievements are calculated
    context.achievements.calculateAchievements();
    rerender();
  }, [context.achievements, rerender]);

  // Aggregate all achievements
  const allAchievements = Array.from(context.achievements.achievementMap.values())
    .flat()
    .sort((a, b) => b.earnedAt - a.earnedAt)
    .slice(0, 5);

  if (allAchievements.length === 0) {
    return null;
  }

  return (
    <div className="bg-primary-background rounded-lg w-full overflow-hidden">
      <Link to="/achievements" className="block" title="View all achievements">
        <h1 className="text-2xl text-center mb-4 mt-[27.5px] text-primary-text hover:underline">Recent achievements</h1>
      </Link>
      <table className="w-full text-primary-text border-collapse">
        <thead>
          <tr className="text-primary-text">
            <th className="py-1 px-2 text-left text-sm xs:text-base font-normal">Player</th>
            <th className="py-1 px-2 text-left text-xs xs:text-sm font-normal">Achievement</th>
            <th className="py-1 px-2 text-right text-sm xs:text-base font-light">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary-text/50">
          {allAchievements.map((achievement, index) => {
            const label = ACHIEVEMENT_LABELS[achievement.type] || {
              title: achievement.type,
              description: "",
              icon: "🏅",
            };

            return (
              <tr
                key={`${achievement.earnedBy}-${achievement.earnedAt}-${index}`}
                onClick={() => navigate(`/player/${achievement.earnedBy}?tab=achievements`)}
                className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors font-light"
              >
                <td className="py-1 px-2 w-[50%] max-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <ProfilePicture playerId={achievement.earnedBy} size={28} border={2} />
                    <span className="text-sm xs:text-base font-normal truncate">{context.playerName(achievement.earnedBy)}</span>
                  </div>
                </td>
                <td className="py-1 px-2 w-[50%] max-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl xs:text-2xl">{label.icon}</span>
                    <span className="text-xs xs:text-sm font-normal truncate">{label.title}</span>
                  </div>
                </td>
                <td className="py-1 px-2 text-right text-sm xs:text-base w-[1%] whitespace-nowrap">
                  <RelativeTime date={new Date(achievement.earnedAt)} variant="short" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
