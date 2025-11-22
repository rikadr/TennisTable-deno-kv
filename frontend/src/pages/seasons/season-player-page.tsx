import { Link } from "react-router-dom";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";
import { useState } from "react";

type SortKey = "performance";

export function SeasonPlayerPage() {
  const context = useEventDbContext();
  const { seasonStart, playerId } = useTennisParams();
  const [sortKey, setSortKey] = useState<SortKey>("performance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
    };
  });

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedMatchups = [...matchupData].sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;

    switch (sortKey) {
      case "performance":
        aVal = a.bestPerformance;
        bVal = b.bestPerformance;
    }

    return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const avgPerformance = playerStats.seasonScore / playerStats.matchups.size;

  // Get opponents not yet played
  const playedOpponentIds = new Set(playerStats.matchups.keys());
  const unplayedOpponents = context.players
    .filter((player) => player.id !== playerId && !playedOpponentIds.has(player.id))
    .sort((a, b) => context.playerName(a.id).localeCompare(context.playerName(b.id)));

  return (
    <div className="px-6">
      <div className="flex items-center gap-4 mb-6">
        <ProfilePicture playerId={playerId} size={64} />
        <div>
          <h1>{context.playerName(playerId)}'s Season Stats</h1>
          <h2 className="text-secondary-text">
            {dateString(Number(season.start))} to {dateString(Number(season.end))}
          </h2>
          {Date.now() > season.end && (
            <p className="text-sm text-secondary-text">Ended {relativeTimeString(new Date(season.end))}</p>
          )}
          {Date.now() > season.start && Date.now() < season.end && (
            <p className="text-sm text-secondary-text">
              Started {relativeTimeString(new Date(season.start))}, ends{" "}
              {relativeTimeString(new Date(season.end)).toLowerCase()}
            </p>
          )}
          {Date.now() < season.start && (
            <p className="text-sm text-secondary-text">Starts {relativeTimeString(new Date(season.start))}</p>
          )}
        </div>

        <div className="grow" />

        <Link
          to={`/season?seasonStart=${seasonStart}`}
          className="text-treasury-text hover:text-treasury-text/80 underline"
        >
          ← Back to Season Leaderboard
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-secondary-background p-4 rounded-lg">
          <div className="text-sm text-secondary-text">Season Rank</div>
          <div className="text-2xl font-bold text-primary-text">#{playerRank}</div>
        </div>
        <div className="bg-secondary-background p-4 rounded-lg">
          <div className="text-sm text-secondary-text">Season Score</div>
          <div className="text-2xl font-bold text-primary-text">{fmtNum(playerStats.seasonScore)}</div>
        </div>
        <div className="bg-secondary-background p-4 rounded-lg">
          <div className="text-sm text-secondary-text">Unique Opponents</div>
          <div className="text-2xl font-bold text-primary-text">{playerStats.matchups.size}</div>
        </div>
        <div className="bg-secondary-background p-4 rounded-lg">
          <div className="text-sm text-secondary-text">Avg. Performance</div>
          <div className="text-2xl font-bold text-primary-text">{fmtNum(avgPerformance)}</div>
        </div>
      </div>

      {/* Matchups Table */}
      <div className="bg-secondary-background rounded-lg overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr className="bg-treasury-background border-b border-treasury-text/20">
              <th className="text-left px-4 text-treasury-text font-semibold cursor-pointer hover:text-treasury-text/80">
                Opponent
              </th>
              <th
                className="text-left px-4 text-treasury-text font-semibold cursor-pointer hover:text-treasury-text/80"
                onClick={() => handleSort("performance")}
              >
                Best Performance{getSortIndicator("performance")}
              </th>
              <th className="text-left px-4 text-treasury-text font-semibold">Performance Breakdown</th>
              <th className="text-left px-4 text-treasury-text font-semibold">Best performance game was played at</th>
            </tr>
          </thead>
          <tbody>
            {sortedMatchups.map(({ opponentId, bestPerformance, gamesPlayed, playedAt, breakdown }) => (
              <tr key={opponentId} className="border-b border-secondary-text/10 hover:bg-primary-background/50">
                <td className="px-4">
                  <div className="flex items-center gap-3">
                    <ProfilePicture playerId={opponentId} size={40} />
                    <Link
                      to={`/season/player?seasonStart=${seasonStart}&playerId=${opponentId}`}
                      className="text-primary-text hover:text-treasury-text font-medium"
                    >
                      {context.playerName(opponentId)}
                    </Link>
                  </div>
                </td>
                <td className="px-4 text-primary-text font-medium">{fmtNum(bestPerformance)}</td>
                <td className="px-4">
                  {breakdown ? (
                    <div className="flex gap-2 text-sm">
                      <span className="text-primary-text">Win: {fmtNum(breakdown.win / 3)}</span>
                      <span className={breakdown.hasSets ? "text-primary-text" : "text-secondary-text/50"}>
                        Sets: {breakdown.hasSets ? fmtNum(breakdown.sets / 3) : "—"}
                      </span>
                      <span className={breakdown.hasBalls ? "text-primary-text" : "text-secondary-text/50"}>
                        Balls: {breakdown.hasBalls ? fmtNum(breakdown.balls / 3) : "—"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-secondary-text text-sm">—</span>
                  )}
                </td>
                <td className="px-4 text-secondary-text">
                  {dateString(playedAt)} - {relativeTimeString(new Date(playedAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unplayed Opponents */}
      {unplayedOpponents.length > 0 && (
        <div className="bg-secondary-background rounded-lg overflow-hidden mb-6">
          <div className="bg-treasury-background px-4 py-2 border-b border-treasury-text/20">
            <h3 className="text-treasury-text font-semibold">
              Opponents you have yet to play ({unplayedOpponents.length})
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {unplayedOpponents.map((opponent) => (
                <Link
                  key={opponent.id}
                  to={`/season/player?seasonStart=${seasonStart}&playerId=${opponent.id}`}
                  className="flex items-center gap-3 p-2 rounded hover:bg-primary-background/50 transition-colors"
                >
                  <ProfilePicture playerId={opponent.id} size={32} />
                  <span className="text-primary-text hover:text-treasury-text">{context.playerName(opponent.id)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Link
          to={`/season?seasonStart=${seasonStart}`}
          className="text-treasury-text hover:text-treasury-text/80 underline"
        >
          ← Back to Season Leaderboard
        </Link>
      </div>
    </div>
  );
}
