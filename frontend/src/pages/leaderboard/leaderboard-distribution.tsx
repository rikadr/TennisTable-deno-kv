import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { classNames } from "../../common/class-names";
import { stringToColor } from "../compare-players-page";

export const LeaderboardDistrubution: React.FC = () => {
  const context = useEventDbContext();
  const leaderboard = context.leaderboard.getLeaderboard();
  const highestElo = leaderboard.rankedPlayers[0]?.elo || 0;
  const lowestElo = leaderboard.rankedPlayers[leaderboard.rankedPlayers.length - 1]?.elo || 0;
  const range = highestElo - lowestElo;

  return (
    <div className="flex flex-col w-full divide-y divide-secondary-background/50">
      {leaderboard?.rankedPlayers.map(({ name, elo }, index) => {
        const fraction = (elo - lowestElo) / range;
        return (
          <Link to={`/player/${name}`} className="group" key={index}>
            <div className="relative w-full h-6 group-hover:bg-primary-text/5">
              <div
                className={classNames(
                  "absolute h-6 group-hover:opacity-75 top-0 transition-all duration-100 left-0 rounded-r-md",
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
