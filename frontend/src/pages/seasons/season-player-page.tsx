import { Link } from "react-router-dom";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";
import { classNames } from "../../common/class-names";

export function SeasonPlayerPage() {
  const context = useEventDbContext();
  const { seasonStart, playerId } = useTennisParams();

  if (!seasonStart) {
    return <div className="p-6 text-primary-text">Season start time not provided</div>;
  }

  if (!playerId) {
    return <div className="p-6 text-primary-text">Player ID not provided</div>;
  }

  const season = context.seasons.getSeasons().find((s) => s.start === Number(seasonStart));
  if (!season) {
    return <div className="p-6 text-primary-text">Season not found for season start time: {seasonStart}</div>;
  }

  const leaderboard = season.getLeaderboard();
  const playerStats = leaderboard.find((p) => p.playerId === playerId);

  if (!playerStats) {
    return (
      <div className="p-6 text-primary-text">
        {context.playerName(playerId)} has not participated in this season yet
      </div>
    );
  }

  const playerRank = leaderboard.findIndex((p) => p.playerId === playerId) + 1;

  // Get all games for this player in this season
  const playerSeasonGames = season.games.filter((game) => game.winner === playerId || game.loser === playerId);

  // Helper function to calculate performance breakdown
  const calculatePerformanceBreakdown = (game: any, isWinner: boolean) => {
    const winPerformance = isWinner ? 100 : 0;

    let setsPerformance = 0;
    let hasSets = false;
    if (game.score?.setsWon) {
      hasSets = true;
      const setsWon = isWinner ? game.score.setsWon.gameWinner : game.score.setsWon.gameLoser;
      const totalSets = game.score.setsWon.gameWinner + game.score.setsWon.gameLoser;
      setsPerformance = (setsWon / totalSets) * 100;
    }

    let ballsPerformance = 0;
    let hasBalls = false;
    if (game.score?.setPoints && game.score.setPoints.length > 0) {
      hasBalls = true;
      const totalBalls = game.score.setPoints.reduce(
        (acc: any, set: any) => ({
          winner: acc.winner + set.gameWinner,
          loser: acc.loser + set.gameLoser,
        }),
        { winner: 0, loser: 0 },
      );
      const playerBalls = isWinner ? totalBalls.winner : totalBalls.loser;
      const total = totalBalls.winner + totalBalls.loser;
      ballsPerformance = (playerBalls / total) * 100;
    }

    return {
      win: winPerformance,
      sets: setsPerformance,
      balls: ballsPerformance,
      hasSets,
      hasBalls,
    };
  };

  // Build matchup data with performance breakdown
  const matchupData = Array.from(playerStats.matchups.entries()).map(([opponentId, matchupStats]) => {
    const gamesWithOpponent = playerSeasonGames.filter(
      (game) => game.winner === opponentId || game.loser === opponentId,
    );

    // Find the best performance game
    const bestGame = playerSeasonGames.find((game) => game.playedAt === matchupStats.playedAt);
    const isWinner = bestGame?.winner === playerId;
    const breakdown = bestGame ? calculatePerformanceBreakdown(bestGame, isWinner) : null;

    return {
      opponentId,
      bestPerformance: matchupStats.bestPerformance,
      gamesPlayed: gamesWithOpponent.length,
      playedAt: matchupStats.playedAt,
      breakdown,
      bestGame: bestGame!,
    };
  });

  const sortedMatchups = [...matchupData].sort((a, b) => b.bestPerformance - a.bestPerformance);

  const avgPerformance = playerStats.seasonScore / playerStats.matchups.size;

  // Get opponents not yet played
  const playedOpponentIds = new Set(playerStats.matchups.keys());
  const unplayedOpponents = context.players
    .filter((player) => player.id !== playerId && !playedOpponentIds.has(player.id))
    .sort((a, b) => context.playerName(a.id).localeCompare(context.playerName(b.id)));

  // Check if any best performance games are missing balls score
  const hasMissingBallsScore = matchupData.some((matchup) => matchup.breakdown && !matchup.breakdown.hasBalls);
  const hasMissingSetScore = matchupData.some((matchup) => matchup.breakdown && !matchup.breakdown.hasSets);
  const hasEnded = Date.now() > season.end;

  return (
    <div className="px-6">
      <div className="flex items-center gap-4 mb-6 text-primary-text bg-primary-background">
        <ProfilePicture playerId={playerId} size={64} border={3} linkToPlayer />
        <div>
          <h1>{context.playerName(playerId)}'s Season Stats</h1>
          <h2>
            {dateString(Number(season.start))} to {dateString(Number(season.end))}
          </h2>
          {Date.now() > season.end && <p className="text-sm">Ended {relativeTimeString(new Date(season.end))}</p>}
          {Date.now() > season.start && Date.now() < season.end && (
            <p className="text-sm">
              Started {relativeTimeString(new Date(season.start))}, ends{" "}
              {relativeTimeString(new Date(season.end)).toLowerCase()}
            </p>
          )}
          {Date.now() < season.start && <p className="text-sm">Starts {relativeTimeString(new Date(season.start))}</p>}
        </div>

        <div className="grow" />

        <Link 
          to={`/season?seasonStart=${seasonStart}`} 
          className="inline-flex items-center gap-2 bg-secondary-background text-secondary-text hover:bg-secondary-background/80 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <span>←</span>
          <span>Back to Season Leaderboard</span>
        </Link>
      </div>

      {/* Missing Score Alert */}
      {hasMissingSetScore && !hasEnded && (
        <div className="mb-6 bg-red-950/80 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🚨</span>
            <div className="flex-1">
              <h3 className="text-red-600 dark:text-red-500 font-semibold mb-1">Missing Important Score Data</h3>
              <p className="text-red-700 dark:text-red-400 text-sm">
                Some of your best performance games are missing set scores! Add set score details to earn up to 33% more
                points per matchup.
              </p>
            </div>
          </div>
        </div>
      )}
      {hasMissingBallsScore && !hasEnded && (
        <div className="mb-6 bg-yellow-950/80 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="text-yellow-600 dark:text-yellow-500 font-semibold mb-1">Maximize Your Season Score</h3>
              <p className="text-yellow-700 dark:text-yellow-400 text-sm">
                You're missing out on potential points! Some of your best performance games don't have detailed ball
                scores. Add the full score details to earn up to 33% more points per matchup.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-secondary-text">
        <div className="bg-secondary-background p-4 rounded-lg">
          <div className="text-sm">Season Rank</div>
          <div className="text-2xl font-bold">
            <span className="font-thin italic mr-0.5">#</span>
            {playerRank}
          </div>
        </div>
        <div className="bg-secondary-background p-4 rounded-lg">
          <div className="text-sm">Season Score</div>
          <div className="text-2xl font-bold">{fmtNum(playerStats.seasonScore)}</div>
        </div>
        <div className="bg-secondary-background p-4 rounded-lg">
          <div className="text-sm">Unique Opponents</div>
          <div className="text-2xl font-bold">{playerStats.matchups.size}</div>
        </div>
        <div className="bg-secondary-background p-4 rounded-lg">
          <div className="text-sm">Avg. Performance</div>
          <div className="text-2xl font-bold">{fmtNum(avgPerformance)}</div>
        </div>
      </div>

      {/* Matchups Table */}
      <div className="bg-secondary-background text-secondary-text rounded-lg overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-secondary-text/20 font-semibold">
                <th className="text-left px-4 py-2">Opponent</th>
                <th className="text-left px-4">Best Performance</th>
                <th className="text-left px-4">Performance Breakdown</th>
                <th className="text-left px-4">Game result</th>
                <th className="text-left px-4">Played at</th>
              </tr>
            </thead>
            <tbody>
              {sortedMatchups.map(({ opponentId, bestPerformance, playedAt, breakdown, bestGame }) => (
                <tr key={opponentId} className="border-b border-secondary-text/10 hover:bg-primary-background/50">
                  <td className="px-4">
                    <Link
                      to={`/season/player?seasonStart=${seasonStart}&playerId=${opponentId}`}
                      className="hover:text-secondary-text font-medium"
                    >
                      <div className="flex items-center gap-3">
                        <ProfilePicture playerId={opponentId} size={35} border={3} shape="rounded" />
                        {context.playerName(opponentId)}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 font-medium">{fmtNum(bestPerformance)}</td>
                  <td className="px-4">
                    {breakdown ? (
                      <div className="flex gap-2 text-sm">
                        Win: {fmtNum(breakdown.win / 3)}
                        <span className={classNames(breakdown.hasSets && "opacity-50")}>
                          Sets: {breakdown.hasSets ? fmtNum(breakdown.sets / 3) : <>{hasEnded ? "-" : "🚨"}</>}
                        </span>
                        <span className={classNames(breakdown.hasBalls && "opacity-50")}>
                          Balls: {breakdown.hasBalls ? fmtNum(breakdown.balls / 3) : <>{hasEnded ? "-" : "⚠️"}</>}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm">—</span>
                    )}
                  </td>
                  <td className="p-1 md:flex items-baseline gap-3">
                    {bestGame.score && (
                      <div className="font-medium">
                        {bestGame.winner === playerId
                          ? `${bestGame.score?.setsWon.gameWinner} - ${bestGame.score?.setsWon.gameLoser}`
                          : `${bestGame.score?.setsWon.gameLoser} - ${bestGame.score?.setsWon.gameWinner}`}
                      </div>
                    )}
                    {bestGame.score?.setPoints && (
                      <div className="font-light italic text-xs">
                        {bestGame.winner === playerId
                          ? bestGame.score.setPoints.map((set) => `${set.gameWinner}-${set.gameLoser}`).join(", ")
                          : bestGame.score.setPoints.map((set) => `${set.gameLoser}-${set.gameWinner}`).join(", ")}
                      </div>
                    )}
                    {!bestGame.score?.setsWon && !bestGame.score?.setPoints && (
                      <p>{bestGame.winner === playerId ? "Won - no score" : "Lost - no score"}</p>
                    )}
                  </td>
                  <td className="px-4 text-sm min-w-64">
                    {dateString(playedAt)} - {relativeTimeString(new Date(playedAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unplayed Opponents */}
      {unplayedOpponents.length > 0 && !hasEnded && (
        <div className="bg-secondary-background text-secondary-text rounded-lg overflow-hidden mb-6">
          <div className="px-4 py-2 border-b border-secondary-text/20">
            <h3 className="font-semibold">Opponents you have yet to play ({unplayedOpponents.length})</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-3">
              {unplayedOpponents.map((opponent) => (
                <Link
                  key={opponent.id}
                  to={`/season/player?seasonStart=${seasonStart}&playerId=${opponent.id}`}
                  className="flex items-center gap-3 p-2 rounded hover:bg-primary-background/50 transition-colors"
                >
                  <ProfilePicture playerId={opponent.id} size={32} border={2} />
                  <span>{context.playerName(opponent.id)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Link
          to={`/season?seasonStart=${seasonStart}`}
          className="inline-flex items-center gap-2 bg-secondary-background text-secondary-text hover:bg-secondary-background/80 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <span>←</span>
          <span>Back to Season Leaderboard</span>
        </Link>
      </div>
    </div>
  );
}
