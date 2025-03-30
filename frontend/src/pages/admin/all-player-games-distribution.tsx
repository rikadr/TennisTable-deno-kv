import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { stringToColor } from "../../common/string-to-color";

export const AllPlayerGamesDistrubution: React.FC = () => {
  const context = useEventDbContext();
  const map: Record<string, number> = {};
  context.games.forEach((game) => {
    map[game.winner] = (map[game.winner] ?? 0) + 1;
    map[game.loser] = (map[game.loser] ?? 0) + 1;
  });
  const mostGames = Math.max(...Object.values(map));
  const summary: { playerId: string; games: number }[] = Object.entries(map)
    .map(([playerId, games]) => ({ playerId, games }))
    .sort((a, b) => b.games - a.games);

  return (
    <div className="flex flex-col w-full px-4 divide-y divide-primary-text/50 max-w-xl">
      {summary.map(({ playerId, games }, index) => {
        const fraction = games / mostGames;
        return (
          <Link to={`/player/${playerId}`} className="group" key={index}>
            <div className="relative w-full h-6 group-hover:bg-primary-text/5">
              <div
                className={classNames(
                  "absolute h-6 group-hover:opacity-75 top-0 transition-all duration-300 left-0 rounded-r-md",
                )}
                style={{ width: `${fraction * 100}%`, backgroundColor: stringToColor(playerId) }}
              />
              <div className="absolute top-0 left-2 text-primary-text">
                {context.playerName(playerId)} ({fmtNum(games)})
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
