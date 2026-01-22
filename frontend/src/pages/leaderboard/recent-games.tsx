import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { RelativeTime } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";
import { Game } from "../../client/client-db/event-store/projectors/games-projector";

const GAMES_COUNT = 5;

type Props = {
  view?: "overall" | "season";
};

type DisplayGame = Game & {
  pointsDiff: number;
};

export const RecentGames: React.FC<Props> = ({ view = "overall" }) => {
  const context = useEventDbContext();
  const leaderboardMap = context.leaderboard.getCachedLeaderboardMap();

  const seasons = context.seasons.getSeasons();
  const currentSeason = seasons.find((s) => Date.now() >= s.start && Date.now() <= s.end);

  const seasonTimeline = useMemo(() => {
    if (view === "season" && currentSeason) {
      return currentSeason.getTimeline().timeline;
    }
    return undefined;
  }, [view, currentSeason]);

  let displayGames = context.games;
  if (view === "season" && currentSeason) {
    displayGames = currentSeason.games;
  }

  const lastGames = displayGames.toReversed().slice(0, GAMES_COUNT + 1);

  function getGame(game: Game): DisplayGame | undefined {
    if (view === "season") {
      if (!currentSeason) return undefined;
      const entry = seasonTimeline?.find((e) => e.time === game.playedAt);
      const imp = entry?.improvements.find((i) => i.playerId === game.winner);
      const pointsDiff = imp ? imp.improvement : 0;
      return { ...game, pointsDiff };
    }

    const winner = leaderboardMap.get(game.winner);
    const loser = leaderboardMap.get(game.loser);
    if (!winner || !loser) {
      return undefined;
    }
    const foundGame = winner!.games.toReversed().find((g) => g.time === game.playedAt);
    return { ...game, ...foundGame, pointsDiff: foundGame?.pointsDiff || 0 } as DisplayGame;
  }

  return (
    <div className="bg-primary-background rounded-lg ">
      <h1 className="text-2xl text-center mb-4 mt-[27.5px] text-primary-text">Recent games</h1>
      <div className="flex flex-col divide-y divide-primary-text/50 text-primary-text">
        <div className="flex gap-4 text-base text-center mb-2">
          <div className="w-24 pl-5">Winner</div>
          <div className="w-32">Loser</div>
          <div className="w-12 whitespace-nowrap -ml-2">Points won</div>
        </div>
        {lastGames
          .map(getGame)
          .filter((g): g is DisplayGame => !!g)
          .map((game, index) => (
            <Link
              key={index}
              to={`/1v1?player1=${game.winner}&player2=${game.loser}`}
              className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text py-1 px-2 flex gap-4 text-xl font-light"
            >
              <div className="w-24 font-normal whitespace-nowrap">🏆 {context.playerName(game.winner)}</div>
              <div className="w-32 text-right font-normal whitespace-nowrap">{context.playerName(game.loser)} 💔</div>
              <div className="w-6 text-right">{fmtNum(game.pointsDiff, { digits: view === 'season' ? 1 : 0 })}</div>
              <div className="w-28 text-right text-base">
                <RelativeTime date={new Date(game.playedAt)} />
              </div>
            </Link>
          ))}
      </div>
      {}
    </div>
  );
};
