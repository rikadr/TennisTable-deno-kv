import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  loserPointsDiff?: number;
};

export const RecentGames: React.FC<Props> = ({ view = "overall" }) => {
  const context = useEventDbContext();
  const navigate = useNavigate();
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
      
      const winnerImp = entry?.improvements.find((i) => i.playerId === game.winner);
      const loserImp = entry?.improvements.find((i) => i.playerId === game.loser);
      
      const pointsDiff = winnerImp ? winnerImp.improvement : 0;
      const loserPointsDiff = loserImp ? loserImp.improvement : 0;
      
      return { ...game, pointsDiff, loserPointsDiff };
    }

    const winner = leaderboardMap.get(game.winner);
    const loser = leaderboardMap.get(game.loser);
    if (!winner || !loser) {
      return undefined;
    }
    const foundGame = winner!.games.toReversed().find((g) => g.time === game.playedAt);
    return { ...game, ...foundGame, pointsDiff: foundGame?.pointsDiff || 0 } as DisplayGame;
  }

  const processedGames = lastGames
    .map(getGame)
    .filter((g): g is DisplayGame => !!g);

  return (
    <div className="bg-primary-background rounded-lg w-full overflow-hidden">
      <h1 className="text-2xl text-center mb-4 mt-[27.5px] text-primary-text">Recent games</h1>
      <table className="w-full text-primary-text border-collapse">
        <thead>
          {view === "season" ? (
            <tr className="text-[9px] xs:text-sm md:text-base font-medium text-primary-text/70">
              <th className="py-1 px-2 text-left font-medium">Winner</th>
              <th className="py-1 px-1 text-right font-medium">Winner's points</th>
              <th className="py-1 px-2 text-right font-medium">Loser</th>
              <th className="py-1 px-1 text-right font-medium">Loser's points</th>
              <th className="py-1 px-2"></th>
            </tr>
          ) : (
            <tr className="text-[9px] xs:text-sm md:text-base font-medium text-primary-text/70">
              <th className="py-1 px-2 text-left font-medium">Winner</th>
              <th className="py-1 px-2 text-right font-medium">Loser</th>
              <th className="py-1 px-2 text-right font-medium">Points won</th>
              <th className="py-1 px-2"></th>
            </tr>
          )}
        </thead>
        <tbody className="divide-y divide-primary-text/20">
          {processedGames.map((game, index) => {
            const rowClick = () => navigate(`/1v1?player1=${game.winner}&player2=${game.loser}`);
            
            if (view === "season") {
              return (
                <tr 
                  key={index} 
                  onClick={rowClick}
                  className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-[10px] xs:text-lg md:text-xl font-light"
                >
                  <td className="py-1 px-2 whitespace-nowrap">
                    <span className="font-normal">🏆 {context.playerName(game.winner)}</span>
                  </td>
                  <td className="py-1 px-1 text-right font-medium">
                    {fmtNum(game.pointsDiff, { digits: 1 })}
                  </td>
                  <td className="py-1 px-2 text-right whitespace-nowrap">
                    <span className="font-normal">{context.playerName(game.loser)} 💔</span>
                  </td>
                  <td className="py-1 px-1 text-right">
                    {game.loserPointsDiff !== undefined ? fmtNum(game.loserPointsDiff, { digits: 1 }) : ""}
                  </td>
                  <td className="py-1 px-2 text-right text-[9px] xs:text-sm md:text-base whitespace-nowrap">
                    <RelativeTime date={new Date(game.playedAt)} />
                  </td>
                </tr>
              );
            }

            return (
              <tr 
                key={index} 
                onClick={rowClick}
                className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-[10px] xs:text-lg md:text-xl font-light"
              >
                <td className="py-1 px-2 whitespace-nowrap">
                  <span className="font-normal">🏆 {context.playerName(game.winner)}</span>
                </td>
                <td className="py-1 px-2 text-right whitespace-nowrap">
                  <span className="font-normal">{context.playerName(game.loser)} 💔</span>
                </td>
                <td className="py-1 px-2 text-right font-medium">
                  +{fmtNum(game.pointsDiff, { digits: 0 })}
                </td>
                <td className="py-1 px-2 text-right text-[9px] xs:text-sm md:text-base whitespace-nowrap">
                  <RelativeTime date={new Date(game.playedAt)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
