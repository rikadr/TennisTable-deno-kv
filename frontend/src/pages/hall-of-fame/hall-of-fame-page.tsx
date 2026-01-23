import React from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { classNames } from "../../common/class-names";

export const HallOfFamePage: React.FC = () => {
  const context = useEventDbContext();
  const hallOfFame = context.hallOfFame?.getHallOfFame() ?? [];

  return (
    <div className="w-full px-4 flex flex-col items-center gap-6 pb-12">
      <div className="w-full max-w-4xl bg-primary-background rounded-lg p-4 md:p-8">
        <h1 className="text-3xl font-bold text-center text-primary-text mb-2 uppercase tracking-wider">🏆 Hall of Fame 🏆</h1>
        <p className="text-center text-primary-text/80 mb-8 font-light">
          Honoring the players who have retired from the league.
        </p>

        {hallOfFame.length === 0 ? (
          <div className="text-center text-secondary-text py-10 italic">
            No players have been inducted into the Hall of Fame yet.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
             {/* Header - Hidden on mobile */}
             <div className="hidden md:grid grid-cols-[80px_1fr_100px_80px_80px_80px] gap-4 px-4 text-[10px] uppercase tracking-widest font-bold text-primary-text/50 border-b border-primary-text/10 pb-2">
                <div></div>
                <div>Player</div>
                <div className="text-right text-yellow-500/80">Legacy</div>
                <div className="text-right">Peak Elo</div>
                <div className="text-right">Win Rate</div>
                <div className="text-right">Games</div>
              </div>

            {hallOfFame.map((player, index) => {
              const isGoat = index === 0;
              return (
                <Link
                  key={player.id}
                  to={`/hall-of-fame/${player.id}`}
                  className={classNames(
                    "grid grid-cols-1 md:grid-cols-[80px_1fr_100px_80px_80px_80px] items-center gap-4 p-4 rounded-xl transition-all",
                    "border group",
                    isGoat 
                      ? "bg-gradient-to-r from-yellow-500/20 via-yellow-600/10 to-transparent border-yellow-500/40 shadow-lg shadow-yellow-500/5 scale-[1.01]" 
                      : "bg-secondary-background/10 hover:bg-secondary-background/20 border-primary-text/5"
                  )}
                >
                  {/* Avatar Column */}
                  <div className="flex justify-center md:justify-start">
                    <div className="relative">
                      <ProfilePicture playerId={player.id} size={isGoat ? 64 : 56} border={isGoat ? 3 : 1} />
                      {isGoat && (
                        <div className="absolute -top-3 -left-3 text-3xl rotate-[-20deg] drop-shadow-md">👑</div>
                      )}
                    </div>
                  </div>

                  {/* Name & Titles Column */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className={classNames(
                        "font-bold text-primary-text truncate",
                        isGoat ? "text-2xl" : "text-lg"
                      )}>{player.name}</span>
                      {isGoat && <span className="shrink-0 text-[8px] font-black uppercase tracking-tighter text-yellow-600 bg-yellow-500/20 px-1 py-0.5 rounded border border-yellow-500/20">GOAT</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {player.titles.slice(0, 3).map((title, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-primary-text/60 font-medium border border-white/5 whitespace-nowrap">
                          {title}
                        </span>
                      ))}
                      {player.titles.length > 3 && <span className="text-[9px] text-primary-text/40">+{player.titles.length - 3} more</span>}
                    </div>
                  </div>

                  {/* Stats Columns - Replaced with flex on mobile, grid on desktop */}
                  <div className="grid grid-cols-2 md:contents gap-4 pt-4 md:pt-0 border-t border-white/5 md:border-0">
                     <StatCell label="Legacy Score" value={player.honors.legacyScore} highlight={true} />
                     <StatCell label="Peak Elo" value={player.honors.peakElo} />
                     <StatCell label="Win Rate" value={`${player.honors.winRate}%`} />
                     <StatCell label="Total Games" value={player.honors.totalGames} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCell = ({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) => (
  <div className="flex flex-col md:block text-right">
    <span className="text-[10px] uppercase text-primary-text/40 md:hidden">{label}</span>
    <span className={classNames(
      "font-mono font-bold block md:inline",
      highlight ? "text-yellow-500 text-lg md:text-xl" : "text-primary-text text-base"
    )}>{value}</span>
  </div>
);
