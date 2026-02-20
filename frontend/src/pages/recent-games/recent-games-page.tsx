import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { RelativeTime } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";
import { Game } from "../../client/client-db/event-store/projectors/games-projector";
import { classNames } from "../../common/class-names";
import { useLocalStorage } from "../../hooks/use-local-storage";
import { session } from "../../services/auth";
import { ProfilePicture } from "../player/profile-picture";

type View = "overall" | "season";

const MIN_GAMES_DEFAULT = 20;
const MIN_GAMES_ADMIN = 100;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

type DisplayGame = Game & {
  pointsDiff: number;
  loserPointsDiff?: number;
};

export const RecentGamesPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const leaderboardMap = context.leaderboard.getCachedLeaderboardMap();

  const isAdmin = session.isAuthenticated && session.sessionData?.role === "admin";
  const minGames = isAdmin ? MIN_GAMES_ADMIN : MIN_GAMES_DEFAULT;

  const [viewString, setViewString] = useLocalStorage("leaderboard_view", "overall");
  const view: View = viewString === "season" ? "season" : "overall";
  const setView = (v: View) => setViewString(v);

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

  const reversedGames = displayGames.toReversed();
  const cutoff = Date.now() - TWENTY_FOUR_HOURS;
  const gamesInLast24h = reversedGames.filter((g) => g.playedAt >= cutoff).length;
  const gamesCount = Math.max(minGames, gamesInLast24h);
  const lastGames = reversedGames.slice(0, gamesCount);

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

  function renderScore(game: DisplayGame) {
    if (!game.score) return <span>-</span>;
    return (
      <div className="leading-tight -my-1">
        <div className="font-medium">
          {game.score.setsWon.gameWinner} - {game.score.setsWon.gameLoser}
        </div>
        {game.score.setPoints && (
          <div className="font-light italic text-[10px] whitespace-nowrap leading-none">
            {game.score.setPoints.map((set) => `${set.gameWinner}-${set.gameLoser}`).join(", ")}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full px-4 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <div className="bg-primary-background rounded-lg w-full overflow-hidden">
          <h1 className="text-2xl text-center mt-2 text-primary-text">Recent games</h1>
          <p className="text-center text-sm text-primary-text/60 mb-1">
            Last {processedGames.length} matches{isAdmin ? " (admin view)" : ""}
          </p>

          {/* View toggle */}
          <div className="flex justify-center gap-2 px-4 py-2 border-b border-primary-text/20">
            <button
              onClick={() => setView("overall")}
              className={classNames(
                "px-4 py-2 rounded text-sm font-medium transition-colors ring-1",
                view === "overall"
                  ? "bg-secondary-background text-secondary-text ring-secondary-text"
                  : "bg-primary-background text-primary-text ring-secondary-background hover:opacity-80",
              )}
            >
              Overall Elo
            </button>
            <button
              onClick={() => setView("season")}
              className={classNames(
                "px-4 py-2 rounded text-sm font-medium transition-colors ring-1",
                view === "season"
                  ? "bg-secondary-background text-secondary-text ring-secondary-text"
                  : "bg-primary-background text-primary-text ring-secondary-background hover:opacity-80",
              )}
            >
              Season Score
            </button>
          </div>

          {view === "season" && !currentSeason ? (
            <div className="p-8 text-center text-primary-text/60">
              <p>No active season at the moment</p>
            </div>
          ) : (
            <table className="w-full text-primary-text border-collapse">
              <thead>
                {view === "season" ? (
                  <tr className="text-xs md:text-sm font-medium text-primary-text/70">
                    <th className="py-1 px-1 md:px-2 text-left font-medium">🏆 Winner</th>
                    <th className="py-1 px-1 text-center font-medium">Score</th>
                    <th className="py-1 px-1 md:px-2 text-right font-medium">Loser 💔</th>
                    <th className="py-1 px-1 text-right font-medium">W pts</th>
                    <th className="py-1 px-1 text-right font-medium">L pts</th>
                    <th className="py-1 px-1 md:px-2"></th>
                  </tr>
                ) : (
                  <tr className="text-xs md:text-sm font-medium text-primary-text/70">
                    <th className="py-1 px-1 md:px-2 text-left font-medium">🏆 Winner</th>
                    <th className="py-1 px-1 text-center font-medium">Score</th>
                    <th className="py-1 px-1 md:px-2 text-right font-medium">Loser 💔</th>
                    <th className="py-1 px-1 md:px-2 text-right font-medium">Elo won</th>
                    <th className="py-1 px-1 md:px-2"></th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-primary-text/20 text-xs md:text-sm">
                {processedGames.map((game, index) => {
                  const rowClick = () => navigate(`/1v1?player1=${game.winner}&player2=${game.loser}`);

                  if (view === "season") {
                    return (
                      <tr
                        key={index}
                        onClick={rowClick}
                        className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors"
                      >
                        <td className="py-1 px-1 md:px-2 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <ProfilePicture playerId={game.winner} size={20} border={2} />
                            <span className="font-medium">{context.playerName(game.winner)}</span>
                          </div>
                        </td>
                        <td className="py-1 px-1 text-center whitespace-nowrap">
                          {renderScore(game)}
                        </td>
                        <td className="py-1 px-1 md:px-2 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <span className="font-medium">{context.playerName(game.loser)}</span>
                            <ProfilePicture playerId={game.loser} size={20} border={2} />
                          </div>
                        </td>
                        <td className="py-1 px-1 text-right font-medium">
                          {fmtNum(game.pointsDiff, { digits: 1 })}
                        </td>
                        <td className="py-1 px-1 text-right">
                          {game.loserPointsDiff !== undefined ? fmtNum(game.loserPointsDiff, { digits: 1 }) : ""}
                        </td>
                        <td className="py-1 px-1 md:px-2 text-right whitespace-nowrap">
                          <RelativeTime date={new Date(game.playedAt)} />
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={index}
                      onClick={rowClick}
                      className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors"
                    >
                      <td className="py-1 px-1 md:px-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <ProfilePicture playerId={game.winner} size={20} border={2} />
                          <span className="font-medium">{context.playerName(game.winner)}</span>
                        </div>
                      </td>
                      <td className="py-1 px-1 text-center whitespace-nowrap">
                        {renderScore(game)}
                      </td>
                      <td className="py-1 px-1 md:px-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-medium">{context.playerName(game.loser)}</span>
                          <ProfilePicture playerId={game.loser} size={20} border={2} />
                        </div>
                      </td>
                      <td className="py-1 px-1 md:px-2 text-right font-medium">
                        +{fmtNum(game.pointsDiff, { digits: 0 })}
                      </td>
                      <td className="py-1 px-1 md:px-2 text-right whitespace-nowrap">
                        <RelativeTime date={new Date(game.playedAt)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
