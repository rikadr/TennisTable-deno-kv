import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";

export const RecentLeaderBoardChanges: React.FC = () => {
  const context = useEventDbContext();
  const leaderboardChanges = context.leaderboardChanges.leaderboardChanges();

  if (leaderboardChanges.length === 0) {
    return null;
  }
  // HAllo test added comment

  return (
    <div className="bg-primary-background rounded-lg ">
      <h1 className="text-2xl text-center mb-4 mt-[27.5px] text-primary-text">Leaderboard changes last 7 days</h1>
      <div className="flex flex-col divide-y divide-primary-text/50 text-primary-text">
        <div className="flex gap-4 text-base text-center mb-2">
          <div className="w-20 pl-5">Player</div>
          <div className="w-24 whitespace-nowrap pl-5">Current place</div>
          <div className="w-32 text-center pl-5">Changes</div>
        </div>
        {leaderboardChanges.map((player) => (
          <Link
            key={player.playerId}
            to={`/player/${player.playerId}`}
            className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text py-1 px-2 flex gap-4 text-xl font-light"
          >
            <ProfilePicture playerId={player.playerId} size={28} border={2} />
            <div className="w-24 font-normal whitespace-nowrap">{context.playerName(player.playerId)}</div>
            <div className="w-10  text-right font-normal whitespace-nowrap">{fmtNum(player.currentPosition)}</div>
            <div className="w-10  text-right font-normal whitespace-nowrap">
              {fmtNum(player.netChange, { signedPositive: true })}
            </div>
            {player.allChanges.length > 1 && (
              <div className="w-24 h-fit mt-2 text-xs font-light whitespace-nowrap">
                {player.allChanges.map((c) => fmtNum(c.change, { signedPositive: true })).join(", ")}
              </div>
            )}
          </Link>
        ))}
      </div>
      {}
    </div>
  );
};
