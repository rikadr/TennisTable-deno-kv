import { Link } from "react-router-dom";
import { classNames } from "../common/class-names";
import { useClientDbContext } from "../wrappers/client-db-context";

type Props = {
  name?: string;
};

export const PlayerPointsDistrubution: React.FC<Props> = ({ name }) => {
  const context = useClientDbContext();
  const summary = context.leaderboard.getPlayerSummary(name || "");
  const highestPoints = summary?.pointsDistrubution[0]?.points || 0;
  const lowestPoints = summary?.pointsDistrubution[summary.pointsDistrubution.length - 1]?.points || 0;
  const range = Math.max(Math.abs(highestPoints), Math.abs(lowestPoints));

  return (
    <div className="flex flex-col w-full px-4 divide-y divide-secondary-background">
      {summary?.pointsDistrubution.map(({ name, points }) => {
        const fraction = points / range;
        return (
          <Link to={`/1v1?player1=${summary.name}&player2=${name}`} className="group" key={name}>
            <div className="relative w-full h-6 group-hover:bg-primary-text/5">
              <div
                className={classNames(
                  "absolute h-6 w-[20%] bg-secondary-background group-hover:bg-secondary-background/70 top-0",
                  points > 0 ? "right-1/2 rounded-l-full" : "left-1/2  rounded-r-full",
                )}
                style={{ width: `${(Math.abs(fraction) / 2) * 100}%` }}
              />
              <div className="absolute top-0 left-2 text-primary-text">{name}</div>
              <div
                className={classNames(
                  "absolute top-0 text-primary-text",
                  points > 0 ? "right-1/2 pr-2" : "left-1/2 pl-2",
                )}
              >
                {points.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
