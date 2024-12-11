import { Link } from "react-router-dom";
import { Game } from "../../client-db/types";
import { useClientDbContext } from "../../wrappers/client-db-context";
import { relativeTimeString } from "../../common/date-utils";

const LAST_GAMES_COUNT = 5;

export const LatestGames: React.FC = () => {
  const context = useClientDbContext();
  const leaderboardMap = context.leaderboard.getCachedLeaderboardMap();
  const lastGames = context.games.slice(context.games.length - LAST_GAMES_COUNT).toReversed();

  function getGame(game: Game) {
    const winner = leaderboardMap.get(game.winner);
    const foundGame = winner!.games.toReversed().find((g) => g.time === game.time);
    return { ...game, ...foundGame };
  }

  return (
    <div>
      <h1 className="text-2xl text-center mt-4">Last {LAST_GAMES_COUNT} games</h1>
      <div className="flex flex-col divide-y divide-primary-text/50">
        <div className="flex gap-4 text-base text-center mb-2">
          <div className="w-24 pl-5">Winner</div>
          <div className="w-32">Loser</div>
          <div className="w-12 whitespace-nowrap">Points won</div>
        </div>
        {lastGames.map(getGame).map((game) => (
          <Link
            key={game.time}
            to={`/1v1?player1=${game.winner}&player2=${game.loser}`}
            className="bg-primary-background hover:bg-secondary-background/30 py-1 px-2 flex gap-4 text-xl font-light"
          >
            <div className="w-24 font-normal whitespace-nowrap">🏆 {game.winner}</div>
            <div className="w-32 text-right font-normal whitespace-nowrap">{game.loser} 💔</div>
            <div className="w-6 text-right">
              {game.pointsDiff!.toLocaleString("no-NO", {
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="w-28 text-right text-base">{relativeTimeString(new Date(game.time))}</div>
          </Link>
        ))}
      </div>
      {}
    </div>
  );
};
