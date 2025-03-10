import { Link } from "react-router-dom";
import { useClientDbContext } from "../../wrappers/client-db-context";
import { classNames } from "../../common/class-names";
import { stringToColor } from "../compare-players-page";

type Props = {
  name?: string;
};

export const PlayerGamesDistrubution: React.FC<Props> = ({ name }) => {
  const context = useClientDbContext();
  const summary = context.leaderboard.getPlayerSummary(name || "");
  const mostGames = summary?.gamesDistribution[0]?.games || 0;

  return (
    <div className="flex flex-col w-full px-4 divide-y divide-primary-text/50">
      {summary?.gamesDistribution.map(({ name, games }, index) => {
        const fraction = games / mostGames;
        return (
          <Link to={`/player/${name}`} className="group" key={index}>
            <div className="relative w-full h-6 group-hover:bg-primary-text/5">
              <div
                className={classNames(
                  "absolute h-6 group-hover:opacity-75 top-0 transition-all duration-300 left-0 rounded-r-md",
                )}
                style={{ width: `${fraction * 100}%`, backgroundColor: stringToColor(name) }}
              />
              <div className="absolute top-0 left-2 text-primary-text">{name}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
