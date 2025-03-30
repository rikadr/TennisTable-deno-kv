import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { classNames } from "../../common/class-names";
import { stringToColor } from "../../common/string-to-color";

type Props = {
  playerId?: string;
};

export const PlayerPointsDistrubution: React.FC<Props> = ({ playerId }) => {
  const context = useEventDbContext();
  const summary = context.leaderboard.getPlayerSummary(playerId || "");
  const highestPoints = summary?.pointsDistrubution[0]?.points || 0;
  const lowestPoints = summary?.pointsDistrubution[summary.pointsDistrubution.length - 1]?.points || 0;
  const range = Math.max(Math.abs(highestPoints), Math.abs(lowestPoints));

  return (
    <div className="flex flex-col w-full px-4 divide-y divide-primary-text/50">
      {summary?.pointsDistrubution.map(({ oponentId, points }, index) => {
        const fraction = points / range;
        return (
          <Link to={`/player/${oponentId}`} className="group" key={index}>
            <div className="relative w-full h-6 group-hover:bg-primary-text/5">
              <div
                className={classNames(
                  "absolute h-6 group-hover:opacity-75 top-0 transition-all duration-300",
                  points > 0 ? "right-1/2 rounded-l-md" : "left-1/2  rounded-r-md",
                )}
                style={{ width: `${(Math.abs(fraction) / 2) * 100}%`, backgroundColor: stringToColor(oponentId) }}
              />
              <div className="absolute top-0 left-2 text-primary-text">{context.playerName(oponentId)}</div>
              <div
                className={classNames(
                  "absolute top-0 text-primary-text",
                  points > 0 ? "right-1/2 pr-2" : "left-1/2 pl-2",
                )}
              >
                {points?.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
