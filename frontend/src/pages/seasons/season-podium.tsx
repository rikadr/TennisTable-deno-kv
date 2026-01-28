import { Link } from "react-router-dom";
import { SeasonPlayerScore } from "../../client/client-db/seasons/season";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";
import { classNames } from "../../common/class-names";

interface Props {
  leaderboard: SeasonPlayerScore[];
  seasonStart: number;
}

export const SeasonPodium = ({ leaderboard, seasonStart }: Props) => {
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
      <div
        className={classNames(
          "flex flex-row xs:flex-col items-center w-full xs:w-1/3 p-2 transition-all duration-300 gap-3 xs:gap-0",
          orderClasses[rank]
        )}
      >
        {/* The Podium Bar - left on mobile, bottom on desktop */}
        <div
          className={classNames(
            "rounded-lg xs:rounded-t-lg xs:rounded-b-none shadow-lg flex items-center xs:items-end justify-center opacity-90 hover:opacity-100 transition-opacity order-1 xs:order-2",
            bgColorClass,
            "w-16 h-16 xs:w-full",
            heightClass
          )}
        >
          <span className={classNames(
            "text-white font-bold select-none xs:pb-4",
            rank === 1 && "text-3xl xs:text-5xl",
            rank === 2 && "text-2xl xs:text-4xl",
            rank === 3 && "text-xl xs:text-3xl"
          )}>{rank}</span>
        </div>

        {/* Avatar and Info - right on mobile, top on desktop */}
        <div className="flex flex-row xs:flex-col items-center gap-3 xs:gap-0 xs:mb-2 z-10 order-2 xs:order-1 flex-1 xs:flex-none">
          <div className="relative shrink-0">
            <div className="xs:hidden">
              <ProfilePicture playerId={player.playerId} size={rank === 1 ? 56 : 48} border={3} shape="circle" />
            </div>
            <div className="hidden xs:block">
              <ProfilePicture playerId={player.playerId} size={rank === 1 ? 80 : 64} border={3} shape="circle" />
            </div>
            <div className="absolute -bottom-1 -right-1 xs:-bottom-2 xs:-right-2 text-xl xs:text-2xl drop-shadow-md filter shadow-black">
              {medal}
            </div>
          </div>
          <div className="flex flex-col xs:items-center">
            <Link
              to={`/season/player?seasonStart=${seasonStart}&playerId=${player.playerId}`}
              className="font-bold text-base xs:text-lg text-primary-text xs:mt-2 hover:underline xs:text-center truncate max-w-[120px] xs:max-w-[150px]"
            >
              {context.playerName(player.playerId)}
            </Link>
            <div className="text-secondary-text text-sm font-medium">
              {fmtNum(player.seasonScore)} pts
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col xs:flex-row xs:items-end xs:justify-center w-full max-w-2xl mx-auto gap-4 mb-4 mt-4">
      {/* 1st Place */}
      {renderPlace(
        first,
        1,
        "xs:h-36",
        "bg-yellow-500/80 xs:bg-yellow-500/60",
        "🥇"
      )}

      {/* 2nd Place */}
      {renderPlace(
        second,
        2,
        "xs:h-28",
        "bg-slate-400/80 xs:bg-slate-400/60",
        "🥈"
      )}

      {/* 3rd Place */}
      {renderPlace(
        third,
        3,
        "xs:h-20",
        "bg-amber-700/80 xs:bg-amber-700/60",
        "🥉"
      )}
    </div>
  );
};
