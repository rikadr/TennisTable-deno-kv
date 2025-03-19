import { Link } from "react-router-dom";
import { Game } from "../../client/client-db/types";
import { useClientDbContext } from "../../wrappers/client-db-context";
import { relativeTimeString } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";

const GAMES_COUNT = 5;

export const RecentGames: React.FC = () => {
  const context = useClientDbContext();
  const leaderboardMap = context.leaderboard.getCachedLeaderboardMap();
  const lastGames = context.games.slice(Math.max(context.games.length - GAMES_COUNT, 0)).toReversed();

  function getGame(game: Game) {
    const winner = leaderboardMap.get(game.winner);
    const loser = leaderboardMap.get(game.loser);
    if (!winner || !loser) {
      return undefined;
    }
    const foundGame = winner!.games.toReversed().find((g) => g.time === game.time);
    return { ...game, ...foundGame };
  }

  return (
    <div>
      <h1 className="text-2xl text-center mb-4 mt-[27.5px] text-primary-text">Recent games</h1>
      <div className="flex flex-col divide-y divide-primary-text text-primary-text">
        <div className="flex gap-4 text-base text-center mb-2">
          <div className="w-24 pl-5">Winner</div>
          <div className="w-32">Loser</div>
          <div className="w-12 whitespace-nowrap -ml-2">Points won</div>
        </div>
        {lastGames
          .map(getGame)
          .filter(Boolean)
          .map((game) => (
            <Link
              key={game!.time}
              to={`/1v1?player1=${game!.winner}&player2=${game!.loser}`}
              className="bg-primary-background hover:bg-secondary-background/30 py-1 px-2 flex gap-4 text-xl font-light"
            >
              <div className="w-24 font-normal whitespace-nowrap">🏆 {game!.winner}</div>
              <div className="w-32 text-right font-normal whitespace-nowrap">{game!.loser} 💔</div>
              <div className="w-6 text-right">{fmtNum(game!.pointsDiff, 0)}</div>
              <div className="w-28 text-right text-base">{relativeTimeString(new Date(game!.time))}</div>
            </Link>
          ))}
      </div>
      {}
    </div>
  );
};
