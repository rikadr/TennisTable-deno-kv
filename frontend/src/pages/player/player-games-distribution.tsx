import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { classNames } from "../../common/class-names";
import { stringToColor } from "../../common/string-to-color";

type Props = {
  playerId?: string;
};

export const PlayerGamesDistrubution: React.FC<Props> = ({ playerId }) => {
  const context = useEventDbContext();
  const summary = context.leaderboard.getPlayerSummary(playerId || "");
  const mostGames = summary?.gamesDistribution[0]?.games || 0;

  return (
    <div className="flex flex-col w-full divide-y divide-primary-text/50">
      {summary?.gamesDistribution.map(({ oponentId, games }, index) => {
        const fraction = games / mostGames;
        return (
          <Link to={`/player/${oponentId}`} className="group" key={index}>
            <div className="relative w-full h-6 group-hover:bg-primary-text/5">
              <div
                className={classNames(
                  "absolute h-6 group-hover:opacity-75 top-0 transition-all duration-300 left-0 rounded-r-md",
                )}
                style={{ width: `${fraction * 100}%`, backgroundColor: stringToColor(oponentId) }}
              />
              <div className="absolute top-0 left-2 text-primary-text">{context.playerName(oponentId)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
