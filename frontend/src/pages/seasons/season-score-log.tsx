import { Link, useSearchParams } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { Season } from "../../client/client-db/seasons/season";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";
import { dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";
import { useMemo } from "react";

type Props = {
  season: Season;
};

export const SeasonScoreLog = ({ season }: Props) => {
  const context = useEventDbContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const playerFilter = searchParams.get("player") || "";
  const opponentFilter = searchParams.get("opponent") || "";

  const setPlayerFilter = (value: string) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (value) {
        newParams.set("player", value);
      } else {
        newParams.delete("player");
      }
      return newParams;
    });
  };

  const setOpponentFilter = (value: string) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (value) {
        newParams.set("opponent", value);
      } else {
        newParams.delete("opponent");
      }
      return newParams;
    });
  };

  const improvements = useMemo(() => {
    const { timeline } = season.getTimeline();
    const allImprovements = timeline.flatMap((entry) =>
      entry.improvements.map((imp) => ({
        ...imp,
        time: entry.time,
      }))
    );
    // Sort by time desc
    return allImprovements.sort((a, b) => b.time - a.time);
  }, [season]);

  // Get unique players for filters
  const uniquePlayers = useMemo(() => {
    const playerIds = new Set<string>();
    improvements.forEach((imp) => {
      playerIds.add(imp.playerId);
      playerIds.add(imp.opponentId);
    });
    return Array.from(playerIds).sort((a, b) => 
      context.playerName(a).localeCompare(context.playerName(b))
    );
  }, [improvements, context]);

  // Filter improvements
  const filteredImprovements = useMemo(() => {
    return improvements.filter((imp) => {
      if (playerFilter && imp.playerId !== playerFilter) return false;
      if (opponentFilter && imp.opponentId !== opponentFilter) return false;
      return true;
    });
  }, [improvements, playerFilter, opponentFilter]);

  return (
    <div className="bg-secondary-background rounded-lg overflow-hidden mt-4">
      {/* Filter Controls */}
      <div className="p-4 border-b border-secondary-text/20">
        <div className="flex flex-wrap gap-4">
          {/* Player Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-secondary-text whitespace-nowrap">Player:</label>
            <select
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
              className="bg-primary-background text-primary-text border border-primary-text/20 rounded px-3 py-1 text-sm"
            >
              <option value="">All Players</option>
              {uniquePlayers.map((playerId) => (
                <option key={playerId} value={playerId}>
                  {context.playerName(playerId)}
                </option>
              ))}
            </select>
            {playerFilter && (
              <button
                onClick={() => setPlayerFilter("")}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
              >
                Clear
              </button>
            )}
          </div>

          {/* Opponent Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-secondary-text whitespace-nowrap">Opponent:</label>
            <select
              value={opponentFilter}
              onChange={(e) => setOpponentFilter(e.target.value)}
              className="bg-primary-background text-primary-text border border-primary-text/20 rounded px-3 py-1 text-sm"
            >
              <option value="">All Opponents</option>
              {uniquePlayers.map((playerId) => (
                <option key={playerId} value={playerId}>
                  {context.playerName(playerId)}
                </option>
              ))}
            </select>
            {opponentFilter && (
              <button
                onClick={() => setOpponentFilter("")}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
              >
                Clear
              </button>
            )}
          </div>

          {/* Results Counter */}
          <div className="ml-auto text-sm text-secondary-text/70 self-center">
            Showing {filteredImprovements.length} of {improvements.length} improvements
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-secondary-text">
          <thead>
            <tr className="bg-secondary-background border-b border-secondary-text/20 text-xs md:text-base">
              <th className="text-left px-1 md:px-4 py-2 font-semibold">Player</th>
              <th className="text-left pl-1 md:pl-4 pr-0 py-2 font-semibold max-w-16">
                <span className="md:hidden">+</span>
                <span className="hidden md:inline">Increase</span>
              </th>
              <th className="text-left pl-2 md:pl-8 pr-1 md:pr-4 py-2 font-semibold">Opponent</th>
              <th className="text-left px-1 md:px-4 py-2 font-semibold whitespace-nowrap">
                <span className="md:hidden">Result</span>
                <span className="hidden md:inline">Game Result</span>
              </th>
              <th className="text-left px-1 md:px-4 py-2 font-semibold">Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredImprovements.map((imp, idx) => (
              <tr key={idx} className="border-b border-secondary-text/10 hover:bg-primary-background/50 text-xs md:text-base">
                <td className="px-1 md:px-4 py-1">
                  <Link
                    to={`/season/player?seasonStart=${season.start}&playerId=${imp.playerId}`}
                    className="flex items-center gap-1 md:gap-2 font-medium hover:underline text-xs md:text-base"
                  >
                    <div className="md:hidden shrink-0"><ProfilePicture playerId={imp.playerId} size={18} border={1} shape="rounded" /></div>
                    <div className="hidden md:block shrink-0"><ProfilePicture playerId={imp.playerId} size={30} border={2} shape="rounded" /></div>
                    <span className="truncate max-w-[70px] md:max-w-none">{context.playerName(imp.playerId)}</span>
                  </Link>
                </td>
                <td className="px-1 md:px-4 py-1 font-bold text-secondary-text max-w-16 text-xs md:text-base">
                  +{fmtNum(imp.improvement)}
                </td>
                <td className="px-1 md:px-4 py-1">
                  <Link
                    to={`/season/player?seasonStart=${season.start}&playerId=${imp.opponentId}`}
                    className="flex items-center gap-1 md:gap-2 hover:underline text-xs md:text-base"
                  >
                    <div className="md:hidden shrink-0"><ProfilePicture playerId={imp.opponentId} size={18} border={1} shape="rounded" /></div>
                    <div className="hidden md:block shrink-0"><ProfilePicture playerId={imp.opponentId} size={30} border={2} shape="rounded" /></div>
                    <span className="truncate max-w-[70px] md:max-w-none">{context.playerName(imp.opponentId)}</span>
                  </Link>
                </td>
                <td className="px-1 md:px-4 py-1 text-xs md:text-base">
                   <div className="flex flex-wrap items-baseline gap-x-1 md:gap-x-2">
                    {imp.game.score && (
                      <span className="font-medium">
                        {imp.game.winner === imp.playerId
                          ? `${imp.game.score?.setsWon.gameWinner} - ${imp.game.score?.setsWon.gameLoser}`
                          : `${imp.game.score?.setsWon.gameLoser} - ${imp.game.score?.setsWon.gameWinner}`}
                      </span>
                    )}
                     {imp.game.score?.setPoints && (
                      <span className="text-xs opacity-70 whitespace-nowrap">
                        {imp.game.winner === imp.playerId
                          ? imp.game.score.setPoints.map((set) => `${set.gameWinner}-${set.gameLoser}`).join(", ")
                          : imp.game.score.setPoints.map((set) => `${set.gameLoser}-${set.gameWinner}`).join(", ")}
                      </span>
                    )}
                   </div>
                </td>
                <td className="px-1 md:px-4 py-1 text-xs md:text-sm opacity-70">
                  <div className="flex flex-col md:flex-row md:flex-wrap md:items-baseline gap-x-2">
                    <span className="whitespace-nowrap">{dateString(imp.time)}</span>
                    <span className="opacity-50">{relativeTimeString(new Date(imp.time))}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
