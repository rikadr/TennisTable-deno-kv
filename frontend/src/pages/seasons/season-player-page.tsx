import { Link, useNavigate } from "react-router-dom";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { dateString, RelativeTime, relativeTimeString } from "../../common/date-utils";
import { GameScoreLink } from "../game/game-score-link";

export function SeasonPlayerPage() {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const { seasonStart, playerId } = useTennisParams();

  if (!seasonStart) {
    return <div className="p-6 text-primary-text">Season start time not provided</div>;
  }

  if (!playerId) {
    return <div className="p-6 text-primary-text">Player ID not provided</div>;
  }

  const seasons = context.seasons.getSeasons();
  const season = seasons.find((s) => s.start === Number(seasonStart));
  if (!season) {
    return <div className="p-6 text-primary-text">Season not found for season start time: {seasonStart}</div>;
  }

  const seasonNumber = seasons.indexOf(season) + 1;
  const leaderboard = season.getLeaderboard();
  const playerStats = leaderboard.find((p) => p.playerId === playerId);

  const hasParticipated = !!playerStats;
  const stats = playerStats || { seasonScore: 0, matchups: new Map<string, any>() };

  const playerRank = hasParticipated ? leaderboard.findIndex((p) => p.playerId === playerId) + 1 : "-";

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
  const matchupData = Array.from(stats.matchups.entries()).map(([opponentId, matchupStats]: [string, any]) => {
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

  const avgPerformance = stats.matchups.size > 0 ? stats.seasonScore / stats.matchups.size : 0;

  // Get opponents not yet played
  const playedOpponentIds = new Set(stats.matchups.keys());
  const unplayedOpponents = context.players
    .filter((player) => player.id !== playerId && !playedOpponentIds.has(player.id))
    .sort((a, b) => context.playerName(a.id).localeCompare(context.playerName(b.id)));

  // Check if any best performance games are missing balls score
  const hasMissingBallsScore = matchupData.some((matchup) => matchup.breakdown && !matchup.breakdown.hasBalls);
  const hasMissingSetScore = matchupData.some((matchup) => matchup.breakdown && !matchup.breakdown.hasSets);
  const hasEnded = Date.now() > season.end;

  return (
    <div className="px-6">
      <div className="flex items-center gap-3 mb-4 text-primary-text">
        <ProfilePicture playerId={playerId} size={40} border={2} linkToPlayer />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{context.playerName(playerId)}</h1>
          <p className="text-xs text-primary-text/60">
            {dateString(Number(season.start))} – {dateString(Number(season.end))}
            {Date.now() > season.end && ` · Ended ${relativeTimeString(new Date(season.end))}`}
            {Date.now() > season.start &&
              Date.now() < season.end &&
              ` · Ends ${relativeTimeString(new Date(season.end)).toLowerCase()}`}
          </p>
        </div>
        <Link
          to={`/season?seasonStart=${seasonStart}`}
          className="text-sm text-primary-text hover:text-primary-text/80 whitespace-nowrap"
        >
          ← Season {seasonNumber}
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
                Some of your best performance games are missing set scores! Add set score details to earn up to 25% more
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
                You're missing out on potential points! Some of your best performance games don't have detailed points
                scores. Add the full score details to earn up to 50% more points per matchup.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-secondary-text">
        <div className="bg-secondary-background px-3 py-1.5 rounded-lg">
          <div className="text-xs">Season Rank</div>
          <div className="text-lg font-bold">
            <span className="font-thin italic mr-0.5">#</span>
            {playerRank}
          </div>
        </div>
        <div className="bg-secondary-background px-3 py-1.5 rounded-lg">
          <div className="text-xs">Season Score</div>
          <div className="text-lg font-bold">{fmtNum(stats.seasonScore)}</div>
        </div>
        <div className="bg-secondary-background px-3 py-1.5 rounded-lg">
          <div className="text-xs">Unique Opponents</div>
          <div className="text-lg font-bold">{stats.matchups.size}</div>
        </div>
        <div className="bg-secondary-background px-3 py-1.5 rounded-lg">
          <div className="text-xs">Avg. Performance</div>
          <div className="text-lg font-bold">{fmtNum(avgPerformance)}</div>
        </div>
      </div>

      {/* Matchups Table */}
      {sortedMatchups.length > 0 && (
        <div className="bg-secondary-background text-secondary-text rounded-lg overflow-hidden mb-6 max-w-3xl mx-auto">
          <table className="w-full text-secondary-text border-collapse">
            <thead className="border-b border-secondary-text/50">
              <tr className="text-xs xs:text-sm md:text-base text-secondary-text">
                <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-medium">Opponent</th>
                <th className="py-1 px-1 xs:px-2 md:px-3 text-right font-medium whitespace-nowrap">Best</th>
                <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-normal">Breakdown</th>
                <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-medium whitespace-nowrap">Result</th>
                <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-normal whitespace-nowrap">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-text/50">
              {sortedMatchups.map(({ opponentId, bestPerformance, playedAt, breakdown, bestGame }) => {
                const setStrings =
                  bestGame.score?.setPoints?.map((set) =>
                    bestGame.winner === playerId
                      ? `${set.gameWinner}-${set.gameLoser}`
                      : `${set.gameLoser}-${set.gameWinner}`,
                  ) ?? [];
                // Max 2 sets per line on tiny screens
                const setLines = Array.from({ length: Math.ceil(setStrings.length / 2) }, (_, i) =>
                  setStrings.slice(i * 2, i * 2 + 2).join(", "),
                );
                return (
                  <tr
                    key={opponentId}
                    onClick={() => navigate(`/season/player?seasonStart=${seasonStart}&playerId=${opponentId}`)}
                    className="hover:bg-primary-background/50 cursor-pointer transition-colors text-xs xs:text-sm md:text-base"
                  >
                    <td className="py-1 px-1 xs:px-2 md:px-3 w-full max-w-0">
                      <div className="flex items-center gap-1 md:gap-3 min-w-0">
                        <div className="md:hidden shrink-0">
                          <ProfilePicture playerId={opponentId} size={18} border={1} shape="rounded" />
                        </div>
                        <div className="hidden md:block shrink-0">
                          <ProfilePicture playerId={opponentId} size={35} border={3} shape="rounded" />
                        </div>
                        <span className="font-medium truncate">{context.playerName(opponentId)}</span>
                      </div>
                    </td>
                    <td className="py-1 px-1 xs:px-2 md:px-3 text-right font-medium w-[1%] whitespace-nowrap">
                      {fmtNum(bestPerformance)}
                    </td>
                    <td className="py-1 px-1 xs:px-2 md:px-3">
                      {breakdown ? (
                        <div className="flex flex-wrap sm:flex-nowrap gap-x-2 text-xs md:text-sm">
                          <span className="whitespace-nowrap" title="Win gives 25% of points">
                            Win: {fmtNum(breakdown.win / 4)}
                            <span className="opacity-50">/25</span>
                          </span>
                          <span className="whitespace-nowrap" title="Set scores give 25% of points">
                            Sets:{" "}
                            {breakdown.hasSets ? (
                              <>
                                {fmtNum(breakdown.sets / 4)}
                                <span className="opacity-50">/25</span>
                              </>
                            ) : (
                              <>{hasEnded ? "-" : "🚨"}</>
                            )}
                          </span>
                          <span className="whitespace-nowrap" title="Ball scores give 50% of points">
                            Points:{" "}
                            {breakdown.hasBalls ? (
                              <>
                                {fmtNum(breakdown.balls / 2)}
                                <span className="opacity-50">/50</span>
                              </>
                            ) : (
                              <>{hasEnded ? "-" : "⚠️"}</>
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs md:text-sm">—</span>
                      )}
                    </td>
                    <td className="py-1 px-1 xs:px-2 md:px-3 w-[1%] whitespace-nowrap">
                      <GameScoreLink playedAt={bestGame.playedAt} className="block">
                        {bestGame.score && (
                          <div className="font-medium text-[11px] xs:text-sm md:text-base">
                            {bestGame.winner === playerId
                              ? `${bestGame.score?.setsWon.gameWinner} - ${bestGame.score?.setsWon.gameLoser}`
                              : `${bestGame.score?.setsWon.gameLoser} - ${bestGame.score?.setsWon.gameWinner}`}
                          </div>
                        )}
                        {setStrings.length > 0 && (
                          <>
                            {/* Tiny screens: smaller text, max 2 sets per line */}
                            <div className="xs:hidden font-light italic text-[10px]">
                              {setLines.map((line, lineIndex) => (
                                <div key={lineIndex} className="whitespace-nowrap">
                                  {line}
                                </div>
                              ))}
                            </div>
                            <div className="hidden xs:block font-light italic text-xs whitespace-nowrap">
                              {setStrings.join(", ")}
                            </div>
                          </>
                        )}
                        {!bestGame.score?.setsWon && !bestGame.score?.setPoints && (
                          <p>{bestGame.winner === playerId ? "Won" : "Lost"}</p>
                        )}
                      </GameScoreLink>
                    </td>
                    <td className="py-1 px-1 xs:px-2 md:px-3 text-xs md:text-sm opacity-70 w-[1%] whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="whitespace-nowrap">{dateString(playedAt)}</span>
                        <span className="opacity-50 whitespace-nowrap">
                          <RelativeTime date={new Date(playedAt)} variant="auto" />
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Unplayed Opponents */}
      {unplayedOpponents.length > 0 && !hasEnded && (
        <div className="bg-secondary-background text-secondary-text rounded-lg overflow-hidden mb-6">
          <div className="px-4 py-2 border-b border-secondary-text/20">
            <h3 className="font-semibold">Opponents you have yet to play ({unplayedOpponents.length})</h3>
          </div>
          <div className="p-2">
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {unplayedOpponents.map((opponent) => (
                <Link
                  key={opponent.id}
                  to={`/season/player?seasonStart=${seasonStart}&playerId=${opponent.id}`}
                  className="flex items-center gap-2 p-1 rounded hover:bg-primary-background/50 transition-colors text-sm"
                >
                  <ProfilePicture playerId={opponent.id} size={24} border={1} />
                  <span className="truncate">{context.playerName(opponent.id)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
