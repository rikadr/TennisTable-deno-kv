import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { useStateAt } from "../../hooks/use-state-at";
import { fmtNum } from "../../common/number-utils";
import { RelativeTime, fullDateTimeString, toDatetimeLocalValue } from "../../common/date-utils";
import { stringToColor } from "../../common/string-to-color";
import { ProfilePicture } from "../player/profile-picture";
import { Fraction } from "../../client/client-db/predictions";
import { WinPercentGraph } from "../add-game/win-percent-graph";
import { replayWinPercentHistory } from "./game-win-replay";
import { durationString, gameTimingStats, gapString, serveStats } from "./game-tracking-stats";
import { GameTracking } from "../../client/client-db/event-store/event-types";

/**
 * Details about a single game, identified by its played-at timestamp (unique
 * per game) in the `time` url param: who played and the score, the Elo the
 * game moved, the pairing win % prediction before and after the game, and the
 * win % over the game replayed from the point-by-point log. Everything the
 * game changed beyond that (leaderboards, achievements) lives on the What
 * changed page, linked with the game's own 2-second window preselected.
 */
export const GameDetailsPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const { time } = useTennisParams();
  const playedAt = time !== null && /^\d+$/.test(time) ? Number(time) : undefined;
  const game = useMemo(
    () => (playedAt === undefined ? undefined : context.games.find((g) => g.playedAt === playedAt)),
    [context, playedAt],
  );

  // The app state just before and just after the game. Both drive the pairing
  // prediction; the pre-game one also seeds the win % replay. The game's
  // GAME_SCORE event is stored at playedAt + 1, so the post state projects
  // there — at playedAt itself the game would count without its score.
  const preState = useStateAt(game ? game.playedAt - 1 : undefined);
  const postState = useStateAt(game ? game.playedAt + 1 : undefined);

  // Elo moved by this game, from the players' game log entries.
  const eloExchange = useMemo(() => {
    if (!game) return undefined;
    const leaderboardMap = context.leaderboard.getCachedLeaderboardMap();
    const winnerGame = leaderboardMap.get(game.winner)?.games.find((g) => g.time === game.playedAt);
    const loserGame = leaderboardMap.get(game.loser)?.games.find((g) => g.time === game.playedAt);
    if (!winnerGame || !loserGame) return undefined;
    return {
      winner: { diff: winnerGame.pointsDiff, after: winnerGame.eloAfterGame },
      loser: { diff: loserGame.pointsDiff, after: loserGame.eloAfterGame },
    };
  }, [context, game]);

  // The overall pairing prediction, from the winner's perspective, in the two
  // projected states. Undefined when there is no data to predict from.
  const preGamePrediction = useMemo(
    () => (game ? preState?.predictions.getPredictedFraction(game.winner, game.loser) : undefined),
    [game, preState],
  );
  const postGamePrediction = useMemo(
    () => (game ? postState?.predictions.getPredictedFraction(game.winner, game.loser) : undefined),
    [game, postState],
  );

  // Win % after every point, replayed from the stored point sequences with the
  // live model. Seeded by the game so the graph is stable across renders. A
  // pair without prediction data replays from an even coin flip, like the
  // live trackers do.
  const winPercentHistory = useMemo(() => {
    if (!game?.score?.pointSequences?.length || !preState) return undefined;
    return replayWinPercentHistory({
      pointSequences: game.score.pointSequences,
      preGameWinChance: preGamePrediction?.fraction ?? 0.5,
      preGameConfidence: preGamePrediction?.confidence ?? 0,
      seed: game.playedAt,
    });
  }, [game, preState, preGamePrediction]);

  if (!game) {
    return <div className="p-8 text-center text-primary-text/60">Game not found</div>;
  }

  const whatChangedLink =
    `/what-changed?range=custom` +
    `&from=${toDatetimeLocalValue(game.playedAt - 1000)}` +
    `&to=${toDatetimeLocalValue(game.playedAt + 1000)}`;

  return (
    <div className="w-full px-4 flex flex-col items-center">
      <div className="w-full max-w-2xl md:max-w-4xl">
        <div className="bg-primary-background rounded-lg w-full overflow-hidden">
          <h1 className="text-2xl md:text-4xl text-center mt-2 md:mt-4 text-primary-text">Game details</h1>
          <p className="text-center text-sm md:text-base text-primary-text/60 mb-2 md:mb-3">
            {fullDateTimeString(game.playedAt)} - <RelativeTime date={new Date(game.playedAt)} variant="auto" />
          </p>

          {/* Who played, the score, and the Elo the game moved */}
          <div className="flex justify-center items-center gap-3 xs:gap-6 px-4 text-primary-text">
            <div
              className="flex flex-col items-center gap-1 flex-1 min-w-0 cursor-pointer"
              onClick={() => navigate(`/player/${game.winner}`)}
            >
              <ProfilePicture playerId={game.winner} size={64} border={3} />
              <span className="font-bold text-sm md:text-base truncate max-w-full">
                🏆 {context.playerName(game.winner)}
              </span>
              {eloExchange && (
                <span className="text-xs md:text-sm text-green-500 font-medium whitespace-nowrap">
                  +{fmtNum(eloExchange.winner.diff)} Elo → {fmtNum(eloExchange.winner.after)}
                </span>
              )}
            </div>

            <div className="flex flex-col items-center shrink-0">
              {game.score ? (
                <>
                  <div className="text-3xl md:text-4xl font-black whitespace-nowrap">
                    {game.score.setsWon.gameWinner} - {game.score.setsWon.gameLoser}
                  </div>
                  {game.score.setPoints && (
                    <div className="font-light italic text-xs md:text-sm whitespace-nowrap text-primary-text/70">
                      {game.score.setPoints.map((set) => `${set.gameWinner}-${set.gameLoser}`).join(", ")}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xl font-bold text-primary-text/60">No score</div>
              )}
            </div>

            <div
              className="flex flex-col items-center gap-1 flex-1 min-w-0 cursor-pointer"
              onClick={() => navigate(`/player/${game.loser}`)}
            >
              <ProfilePicture playerId={game.loser} size={64} border={3} />
              <span className="font-bold text-sm md:text-base truncate max-w-full">
                {context.playerName(game.loser)} 💔
              </span>
              {eloExchange && (
                <span className="text-xs md:text-sm text-red-500 font-medium whitespace-nowrap">
                  {fmtNum(eloExchange.loser.diff)} Elo → {fmtNum(eloExchange.loser.after)}
                </span>
              )}
            </div>
          </div>

          {/* The pairing prediction before and after the game */}
          <div className="max-w-md mx-auto mt-3 px-4">
            <div className="rounded-lg bg-secondary-background text-secondary-text p-3">
              <h2 className="text-sm font-semibold text-center mb-1">
                Win % prediction: {context.playerName(game.winner)} beats {context.playerName(game.loser)}
              </h2>
              <div className="flex justify-center items-center gap-3 text-center">
                <PredictionCell label="Before the game" prediction={preGamePrediction} />
                <span className="text-xl">→</span>
                <PredictionCell label="After the game" prediction={postGamePrediction} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 py-3">
            <button
              onClick={() => navigate(`/1v1?player1=${game.winner}&player2=${game.loser}`)}
              className="px-4 py-1.5 rounded-full text-xs md:text-sm ring-1 ring-secondary-background text-primary-text hover:bg-secondary-background hover:text-secondary-text transition-colors"
            >
              Head-to-head stats
            </button>
            <button
              onClick={() => navigate(whatChangedLink)}
              className="px-4 py-1.5 rounded-full text-xs md:text-sm ring-1 ring-secondary-background text-primary-text hover:bg-secondary-background hover:text-secondary-text transition-colors"
            >
              What this game changed →
            </button>
          </div>

          {/* How long the game took, and how each player did on their serve */}
          {game.score?.tracking && game.score.pointSequences && (
            <div className="px-2 xs:px-4 pb-3">
              <TrackingStats
                tracking={game.score.tracking}
                pointSequences={game.score.pointSequences}
                winnerName={context.playerName(game.winner)}
                loserName={context.playerName(game.loser)}
              />
            </div>
          )}

          {/* Win % over the game, replayed from the point-by-point log */}
          <div className="px-2 xs:px-4 pb-4">
            {winPercentHistory && winPercentHistory.length >= 2 && game.score?.setPoints ? (
              <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 text-black">
                <WinPercentGraph
                  history={winPercentHistory}
                  winnerIsPlayer1={true}
                  winnerName={context.playerName(game.winner)}
                  winnerColor={stringToColor(game.winner)}
                  completedSets={game.score.setPoints.map((set) => ({
                    player1: set.gameWinner,
                    player2: set.gameLoser,
                  }))}
                />
              </div>
            ) : (
              <p className="text-center text-sm text-primary-text/60 py-2">
                This game has no point-by-point log, so there is no win % graph. Only games tracked live record it.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * The timeline and serve data of a tracked game. The gaps are the time between
 * two points being registered, so they include everything that happens between
 * the rallies, not the rally alone.
 */
const TrackingStats: React.FC<{
  tracking: GameTracking;
  pointSequences: string[];
  winnerName: string;
  loserName: string;
}> = ({ tracking, pointSequences, winnerName, loserName }) => {
  const timing = gameTimingStats(tracking);
  const serves = serveStats(pointSequences, tracking.firstServers);
  const servePercent = (side: { served: number; won: number }) =>
    side.served === 0 ? "–" : `${fmtNum((side.won / side.served) * 100)}%`;

  return (
    <div className="rounded-lg bg-secondary-background text-secondary-text p-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-3 text-center">
        <StatCell label="Duration" value={durationString(timing.durationMs)} />
        <StatCell
          label="Sets"
          value={timing.setDurationsMs.map((ms) => durationString(ms)).join(" · ")}
        />
        <StatCell label="Between points" value={gapString(timing.averagePointGapMs)} />
        <StatCell label="Longest pause" value={gapString(timing.longestPointGapMs)} />
      </div>
      <div className="mt-3 pt-3 border-t border-secondary-text/20 grid grid-cols-2 gap-x-3 text-center">
        <StatCell label={`${winnerName} on serve`} value={servePercent(serves.winner)} />
        <StatCell label={`${loserName} on serve`} value={servePercent(serves.loser)} />
      </div>
    </div>
  );
};

const StatCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col items-center min-w-0">
    <span className="text-xs opacity-70 truncate max-w-full">{label}</span>
    <span className="text-lg font-bold truncate max-w-full">{value}</span>
  </div>
);

const PredictionCell: React.FC<{ label: string; prediction?: Fraction }> = ({ label, prediction }) => (
  <div className="flex flex-col items-center">
    <span className="text-xs opacity-70">{label}</span>
    {prediction && prediction.confidence > 0 ? (
      <>
        <span className="text-2xl font-bold">{fmtNum(prediction.fraction * 100)}%</span>
        <span className="text-xs opacity-70">{fmtNum(prediction.confidence * 100)}% confidence</span>
      </>
    ) : (
      <span className="text-2xl font-bold opacity-60">–</span>
    )}
  </div>
);
