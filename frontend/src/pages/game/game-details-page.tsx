import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { session } from "../../services/auth";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { useStateAt } from "../../hooks/use-state-at";
import { fmtNum } from "../../common/number-utils";
import { RelativeTime, fullDateTimeString, toDatetimeLocalValue } from "../../common/date-utils";
import { stringToColor } from "../../common/string-to-color";
import { ProfilePicture } from "../player/profile-picture";
import { Fraction } from "../../client/client-db/predictions";
import { WinPercentGraph } from "../add-game/win-percent-graph";
import { replayWinPercentHistory } from "./game-win-replay";
import { pointSituations, setProgressions } from "./game-tracking-stats";
import { SetBreakdownTable, SetSidesTable, TrackingStats } from "./game-tracking-panels";
import { SetScoreGraphs } from "./set-score-graphs";
import { PointSituationRadar } from "./point-situation-radar";
import { playerStandingsAt, seasonOfGame } from "../../client/client-db/game-standings";
import { GameAchievements } from "./game-achievements-panel";
import { GameTournaments } from "./game-tournaments-panel";
import { useGameHallOfFameChange } from "../../hooks/use-game-hall-of-fame-change";
import { StandingsChangeTable } from "./game-standings-panel";

/**
 * Details about a single game, identified by its played-at timestamp (unique
 * per game) in the `time` url param: who played and the score, the Elo the
 * game moved, the tournaments it was part of, the ranks and the scores it
 * moved on the leaderboards, the achievements it earned, the pairing win %
 * prediction before and after the game, and the win % over the game replayed
 * from the point-by-point log.
 * Everything the game changed for the other players lives on the What changed
 * page, linked with the game's own 2-second window preselected.
 */
export const GameDetailsPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const isAdmin = session.isAuthenticated && session.sessionData?.role === "admin";
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

  // The season the game counts towards. A game played in the break between
  // two seasons counts towards none, and then it moves no season score.
  const season = useMemo(() => (game ? seasonOfGame(context, game.playedAt) : undefined), [context, game]);

  // Where both players stood on the overall leaderboard and on the season
  // leaderboard, just before and just after the game.
  const standings = useMemo(() => {
    if (!game) return undefined;
    return {
      winner: {
        before: playerStandingsAt(preState, game.winner, season?.start),
        after: playerStandingsAt(postState, game.winner, season?.start),
      },
      loser: {
        before: playerStandingsAt(preState, game.loser, season?.start),
        after: playerStandingsAt(postState, game.loser, season?.start),
      },
    };
  }, [game, preState, postState, season]);

  // The achievements this game earned. A game can earn one for a player who
  // did not play it: it can lift another player onto the podium, and a King
  // Maker goes to the opponent who built the new leader's climb. The 2 players
  // of the game come first, the rest keep the order the list gives them.
  const achievements = useMemo(() => {
    if (!game) return [];
    const order = (playerId: string) => (playerId === game.winner ? 0 : playerId === game.loser ? 1 : 2);
    return context.achievements
      .getAchievementsEarnedByGame(game.id)
      .map((achievement, index) => ({ achievement, index }))
      .sort((a, b) => order(a.achievement.earnedBy) - order(b.achievement.earnedBy) || a.index - b.index)
      .map(({ achievement }) => achievement);
  }, [context, game]);

  // The tournaments this game was part of. Two tournaments that run at the
  // same time both count a game between their players, so this is a list.
  const tournamentPlacements = useMemo(() => context.tournaments.findGamePlacements(game?.playedAt), [context, game]);

  // The Hall of Fame score of the two players before and after the game. It is
  // calculated in a web worker, so the page renders without waiting for it.
  const hallOfFame = useGameHallOfFameChange(game?.playedAt, game ? [game.winner, game.loser] : []);

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

          <div className="flex flex-wrap justify-center gap-2 py-3">
            <button
              onClick={() => navigate(`/1v1?player1=${game.winner}&player2=${game.loser}`)}
              className="px-4 py-1.5 rounded-full text-xs md:text-sm ring-1 ring-secondary-background text-primary-text hover:bg-secondary-background hover:text-secondary-text transition-colors"
            >
              👥🥊 Compare 1v1
            </button>
            <button
              onClick={() => navigate(whatChangedLink)}
              className="px-4 py-1.5 rounded-full text-xs md:text-sm ring-1 ring-secondary-background text-primary-text hover:bg-secondary-background hover:text-secondary-text transition-colors"
            >
              ⏳ What this game changed
            </button>
            {/* An admin can edit every game; anyone else only a game from the
                last 7 days, like the edit button in the player page's game list */}
            {(isAdmin || Date.now() - game.playedAt < 7 * 24 * 60 * 60 * 1000) && (
              <button
                onClick={() => navigate(`/game/edit/score?gameId=${game.id}`)}
                className="px-4 py-1.5 rounded-full text-xs md:text-sm ring-1 ring-secondary-background text-primary-text hover:bg-secondary-background hover:text-secondary-text transition-colors"
              >
                Edit game
              </button>
            )}
          </div>

          {/* The tournaments the game was part of, and where it sat in each */}
          <GameTournaments placements={tournamentPlacements} />

          {/* The pairing prediction before and after the game */}
          <div className="max-w-md mx-auto px-4 pb-3">
            <div
              className="rounded-lg bg-secondary-background text-secondary-text p-3 cursor-pointer hover:bg-secondary-background/80 transition-colors"
              onClick={() =>
                navigate(`/player/${game.winner}?tab=predictions&predictionTab=history&compareWith=${game.loser}`)
              }
            >
              <h2 className="text-sm font-semibold text-center mb-1">
                Win prediction for {context.playerName(game.winner)}
              </h2>
              <div className="flex justify-center items-center gap-3 text-center">
                <PredictionCell label="Before" prediction={preGamePrediction} />
                <span className="text-xl">→</span>
                <PredictionCell label="After" prediction={postGamePrediction} />
              </div>
            </div>
          </div>

          {/* The ranks and the scores the game moved for the two players */}
          {standings && (
            <div className="px-2 xs:px-4 pb-3 space-y-2">
              <h2 className="text-sm font-semibold text-center text-primary-text">Ranks and scores</h2>
              <div className="flex flex-col md:flex-row md:justify-center gap-2 md:gap-3">
                <StandingsChangeTable
                  playerId={game.winner}
                  name={context.playerName(game.winner)}
                  marker="🏆"
                  before={standings.winner.before}
                  after={standings.winner.after}
                  hallOfFame={{
                    before: hallOfFame.byPlayer.get(game.winner)?.before,
                    after: hallOfFame.byPlayer.get(game.winner)?.after,
                    pending: hallOfFame.pending,
                  }}
                  season={season}
                />
                <StandingsChangeTable
                  playerId={game.loser}
                  name={context.playerName(game.loser)}
                  marker="💔"
                  before={standings.loser.before}
                  after={standings.loser.after}
                  hallOfFame={{
                    before: hallOfFame.byPlayer.get(game.loser)?.before,
                    after: hallOfFame.byPlayer.get(game.loser)?.after,
                    pending: hallOfFame.pending,
                  }}
                  season={season}
                />
              </div>
              {!season && (
                <p className="text-center text-xs text-primary-text/60">
                  The game is in the break between two seasons, so it changes no season score.
                </p>
              )}
            </div>
          )}

          {/* The achievements this game earned, for either player */}
          <GameAchievements achievements={achievements} />

          {/* Everything the live tracker recorded: the timeline, the serves,
              the sets one by one, and the pace of the points */}
          {game.score?.tracking && game.score.pointSequences && (
            <div className="px-2 xs:px-4 pb-3 space-y-3">
              <TrackingStats
                tracking={game.score.tracking}
                pointSequences={game.score.pointSequences}
                winnerName={context.playerName(game.winner)}
                loserName={context.playerName(game.loser)}
              />
              <SetBreakdownTable
                tracking={game.score.tracking}
                pointSequences={game.score.pointSequences}
                gameWinnerSides={game.score.gameWinnerSides}
                winnerName={context.playerName(game.winner)}
                loserName={context.playerName(game.loser)}
              />
            </div>
          )}

          {/* A game entered by hand can still record the sides of the table,
              with or without the points of each set */}
          {!game.score?.tracking && game.score?.gameWinnerSides && (
            <div className="px-2 xs:px-4 pb-3">
              <SetSidesTable
                gameWinnerSides={game.score.gameWinnerSides}
                setPoints={game.score.setPoints}
                winnerName={context.playerName(game.winner)}
                loserName={context.playerName(game.loser)}
              />
            </div>
          )}

          {/* Everything read off the point-by-point log: the win % over the
              game, the points of each set, and how the two players compare */}
          {winPercentHistory && winPercentHistory.length >= 2 && game.score?.setPoints && game.score.pointSequences && (
            <div className="px-2 xs:px-4 pb-4">
              <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 text-black space-y-3">
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
                <SetScoreGraphs
                  progressions={setProgressions(game.score.pointSequences)}
                  winnerName={context.playerName(game.winner)}
                  loserName={context.playerName(game.loser)}
                  winnerColor={stringToColor(game.winner)}
                  loserColor={stringToColor(game.loser)}
                />
                {game.score.tracking && (
                  <PointSituationRadar
                    situations={pointSituations(game.score.pointSequences, game.score.tracking)}
                    winnerName={context.playerName(game.winner)}
                    loserName={context.playerName(game.loser)}
                    winnerColor={stringToColor(game.winner)}
                    loserColor={stringToColor(game.loser)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
