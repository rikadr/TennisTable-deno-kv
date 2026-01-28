import { Link } from "react-router-dom";
import { SeasonPlayerScore } from "../../client/client-db/seasons/season";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";
import { classNames } from "../../common/class-names";

interface Props {
  leaderboard: SeasonPlayerScore[];
  seasonStart: number;
  isOngoing?: boolean;
}

export const SeasonPodium = ({ leaderboard, seasonStart, isOngoing = false }: Props) => {
  const context = useEventDbContext();
  const [first, second, third] = leaderboard;

  if (!first) return null;

  // Static order classes for Tailwind JIT compilation
  const orderClasses: Record<1 | 2 | 3, string> = {
    1: "order-1 xs:order-2", // 1st: mobile first, desktop middle
    2: "order-2 xs:order-3", // 2nd: mobile second, desktop right
    3: "order-3 xs:order-1", // 3rd: mobile third, desktop left
  };

  const renderPlace = (
    player: SeasonPlayerScore | undefined,
    rank: 1 | 2 | 3,
    heightClass: string,
    bgColorClass: string,
    medal: string
  ) => {
    if (!player) {
      return (
        <div
          className={classNames(
            "flex-1 hidden xs:flex",
            orderClasses[rank]
          )}
        />
      );
    }

    return (
      <Link
        to={`/season/player?seasonStart=${seasonStart}&playerId=${player.playerId}`}
        className={classNames(
          "flex flex-row xs:flex-col items-center w-full xs:w-1/3 p-2 transition-all duration-300 gap-3 xs:gap-0 hover:scale-105",
          orderClasses[rank]
        )}
      >
        {/* The Podium Bar - left on mobile, bottom on desktop */}
        <div
          className={classNames(
            "rounded-lg xs:rounded-t-lg xs:rounded-b-none flex items-center xs:items-end justify-center transition-opacity order-1 xs:order-2",
            "w-16 h-16 xs:w-full",
            heightClass,
            isOngoing
              ? "bg-transparent border-2 border-current opacity-60"
              : classNames(bgColorClass, "shadow-lg opacity-90 group-hover:opacity-100")
          )}
          style={isOngoing ? { borderColor: rank === 1 ? '#facc15' : rank === 2 ? '#cbd5e1' : '#f59e0b' } : undefined}
        >
          <span
            className={classNames(
              "font-bold select-none xs:pb-4",
              rank === 1 && "text-3xl xs:text-5xl",
              rank === 2 && "text-2xl xs:text-4xl",
              rank === 3 && "text-xl xs:text-3xl",
              isOngoing
                ? rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : "text-amber-500"
                : "text-white",
            )}
            style={isOngoing ? undefined : { textShadow: '1px 1px 2px rgba(0,0,0,0.2)' }}
          >{isOngoing ? rank + "?" : rank}</span>
        </div>

        {/* Avatar and Info - right on mobile, top on desktop */}
        <div className="flex flex-row xs:flex-col items-center gap-3 xs:gap-0 xs:mb-2 order-2 xs:order-1 flex-1 xs:flex-none">
          <div className="relative shrink-0">
            <div className="xs:hidden">
              <ProfilePicture playerId={player.playerId} size={rank === 1 ? 56 : 48} border={3} shape="circle" />
            </div>
            <div className="hidden xs:block">
              <ProfilePicture playerId={player.playerId} size={rank === 1 ? 80 : 64} border={3} shape="circle" />
            </div>
            {!isOngoing && (
              <div className="absolute -bottom-1 -right-1 xs:-bottom-2 xs:-right-2 text-xl xs:text-2xl drop-shadow-md filter shadow-black">
                {medal}
              </div>
            )}
          </div>
          <div className="flex flex-col xs:items-center">
            <span className="font-bold text-base xs:text-lg text-primary-text xs:mt-2 xs:text-center truncate max-w-[120px] xs:max-w-[150px]">
              {context.playerName(player.playerId)}
            </span>
            <div className="text-secondary-text text-sm font-medium">
              {fmtNum(player.seasonScore)} pts
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="flex flex-col xs:flex-row xs:items-end xs:justify-center w-full max-w-2xl mx-auto gap-1 xs:gap-4 mb-4 mt-4">
      {/* 1st Place */}
      {renderPlace(
        first,
        1,
        "xs:h-24",
        "bg-yellow-400",
        "🥇"
      )}

      {/* 2nd Place */}
      {renderPlace(
        second,
        2,
        "xs:h-20",
        "bg-slate-300",
        "🥈"
      )}

      {/* 3rd Place */}
      {renderPlace(
        third,
        3,
        "xs:h-16",
        "bg-amber-500",
        "🥉"
      )}
    </div>
  );
};
