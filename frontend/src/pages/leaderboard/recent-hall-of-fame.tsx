import React from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

export const RecentHallOfFame: React.FC = () => {
  const context = useEventDbContext();

  const recentlyRetired = context.eventStore.playersProjector.inactivePlayers.filter(
    (player) => !player.active && Date.now() - player.updatedAt < TWO_WEEKS,
  );

  if (recentlyRetired.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-2">
      {recentlyRetired.map((player) => {
        const entry = context.hallOfFame.getPlayerScore(player.id);
        return (
          <Link
            key={player.id}
            to={`/hall-of-fame/${player.id}`}
            className="w-full rounded-lg p-3 text-white shadow-lg transition-all bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 hover:from-amber-500 hover:via-yellow-400 hover:to-amber-500"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏛️</span>
                <span className="text-xs font-bold uppercase tracking-wider">
                  Hall of Fame — Newly Retired
                </span>
              </div>
              <span className="text-xs opacity-80">Tap to honor</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <ProfilePicture playerId={player.id} size={48} border={2} />
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-lg truncate">{player.name}</span>
                  <span className="text-xs uppercase tracking-wider opacity-80">
                    Thank you for the games ❤️
                  </span>
                </div>
              </div>
              {entry && (
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                    HoF Score
                  </span>
                  <span className="text-2xl font-black">{fmtNum(entry.score.total)}</span>
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
};
