import { useNavigate } from "react-router-dom";
import { Achievement } from "../../client/client-db/achievements";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { playerAchievementProgressLink } from "../player/player-achievement-link";
import { getAchievementLabel } from "../player/player-achievements";
import { ProfilePicture } from "../player/profile-picture";

/**
 * The achievements that a game earned. A game earns an achievement the moment
 * it makes it true, so an achievement here can belong to a player who did not
 * play the game, and one whose rule only completes later - a Perfect Day is
 * earned by the last win of the day - is stamped at the game that earned it.
 *
 * A row opens the achievements of the player who earned it, on that
 * achievement's own progress row.
 */
export const GameAchievements: React.FC<{ achievements: Achievement[] }> = ({ achievements }) => {
  const context = useEventDbContext();
  const navigate = useNavigate();

  if (achievements.length === 0) return null;

  return (
    <div className="px-2 xs:px-4 pb-3 space-y-2">
      <h2 className="text-sm font-semibold text-center text-primary-text">
        {achievements.length === 1 ? "1 achievement earned" : `${achievements.length} achievements earned`}
      </h2>
      <div className="bg-primary-background rounded-lg w-full max-w-md mx-auto overflow-hidden ring-1 ring-primary-text/20">
        <table className="w-full text-primary-text border-collapse">
          <tbody className="divide-y divide-primary-text/50">
            {achievements.map((achievement, index) => {
              const label = getAchievementLabel(achievement.type, context.client.gameLimitForRanked);
              return (
                <tr
                  key={`${achievement.type}-${achievement.earnedBy}-${index}`}
                  onClick={() => navigate(playerAchievementProgressLink(achievement.earnedBy, achievement.type))}
                  className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-xs xs:text-sm md:text-base"
                >
                  <td className="py-1 px-1 xs:px-2 md:px-3 w-[1%]">
                    <span className="text-xl md:text-2xl">{label.icon}</span>
                  </td>
                  <td className="py-1 px-1 xs:px-2 w-[60%] max-w-0">
                    <div className="truncate font-normal">{label.title}</div>
                  </td>
                  <td className="py-1 px-1 xs:px-2 md:px-3 w-[40%] max-w-0">
                    <div className="flex items-center justify-end gap-1 md:gap-2 min-w-0">
                      <span className="truncate font-light">{context.playerName(achievement.earnedBy)}</span>
                      <ProfilePicture playerId={achievement.earnedBy} size={24} border={2} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
