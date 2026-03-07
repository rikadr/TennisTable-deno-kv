import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

export const RecentHallOfFame: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();

  const recentlyRetired = context.eventStore.playersProjector.inactivePlayers.filter(
    (player) => !player.active && Date.now() - player.updatedAt < TWO_WEEKS,
  );

  if (recentlyRetired.length === 0) return null;

  return (
    <div className="bg-primary-background rounded-lg w-full p-4">
      <Link to="/hall-of-fame" className="block hover:opacity-80 mb-3">
        <h2 className="text-lg font-semibold text-primary-text text-center mb-1">Hall of Fame</h2>
        <p className="text-primary-text text-sm text-center">Recently retired</p>
      </Link>
      <table className="w-full text-primary-text">
        <thead>
          <tr className="text-sm">
            <th className="text-left py-1 px-2 font-medium">Player</th>
            <th className="text-right py-1 px-2 font-medium">Hall of Fame Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary-background">
          {recentlyRetired.map((player) => {
            const entry = context.hallOfFame.getPlayerScore(player.id);
            return (
              <tr
                key={player.id}
                onClick={() => navigate(`/hall-of-fame/${player.id}`)}
                className="cursor-pointer hover:bg-secondary-background hover:text-secondary-text"
              >
                <td className="py-2 px-2">
                  <div className="flex items-center gap-3 font-medium">
                    <ProfilePicture playerId={player.id} size={28} border={2} />
                    {player.name}
                  </div>
                </td>
                <td className="py-2 px-2 text-right text-primary-text font-semibold text-sm">
                  {entry && fmtNum(entry.score.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
