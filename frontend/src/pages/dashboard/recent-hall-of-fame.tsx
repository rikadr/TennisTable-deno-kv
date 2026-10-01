import React from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";
import { isRecentlyRetired } from "../hall-of-fame/recently-retired";

export const RecentHallOfFame: React.FC = () => {
  const context = useEventDbContext();

  const recentlyRetired = context.eventStore.playersProjector.inactivePlayers
    .filter(isRecentlyRetired)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (recentlyRetired.length === 0) return null;

  const multiple = recentlyRetired.length > 1;

  return (
    <Link
      to={multiple ? "/hall-of-fame" : `/hall-of-fame/${recentlyRetired[0].id}`}
      className="w-full rounded-lg p-3 text-white shadow-lg transition-all bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 hover:from-amber-500 hover:via-yellow-400 hover:to-amber-500"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏛️</span>
          <span className="text-xs font-bold uppercase tracking-wider">Hall of Fame — Newly Retired</span>
        </div>
        <span className="text-xs opacity-80">Tap to honor</span>
      </div>
      <div className="flex flex-col gap-2">
        {recentlyRetired.map((player) => {
          const entry = context.hallOfFame.getPlayerScore(player.id);
          return (
            <div key={player.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <ProfilePicture playerId={player.id} size={multiple ? 36 : 48} border={2} />
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-lg truncate">{player.name}</span>
                  {multiple === false && (
                    <span className="text-xs uppercase tracking-wider opacity-80">Thank you for the games ❤️</span>
                  )}
                </div>
              </div>
              {entry &&
                (multiple ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">HoF</span>
                    <span className="text-xl font-black">{fmtNum(entry.score.total)}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">HoF Score</span>
                    <span className="text-2xl font-black">{fmtNum(entry.score.total)}</span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
      {multiple && <div className="text-xs uppercase tracking-wider opacity-80 mt-2">Thank you for the games ❤️</div>}
    </Link>
  );
};
