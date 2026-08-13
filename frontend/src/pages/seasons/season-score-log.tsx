import { useSearchParams } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { Season } from "../../client/client-db/seasons/season";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";
import { dateString, RelativeTime } from "../../common/date-utils";
import { PointSequenceMarker } from "../game/point-sequence-marker";
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
    <div className="bg-secondary-background rounded-lg overflow-hidden mt-4 max-w-3xl mx-auto">
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

      <table className="w-full text-secondary-text border-collapse">
        <thead className="border-b border-secondary-text/50">
          <tr className="text-xs xs:text-sm md:text-base text-secondary-text">
            <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-medium">Player</th>
            <th className="py-1 px-1 xs:px-2 md:px-3 font-bold w-[1%]">
              {/* Zero-width so the label doesn't widen the hug column; overflows leftward */}
              <div className="w-0 ml-auto whitespace-nowrap" dir="rtl">
                <bdi dir="ltr">Increase</bdi>
              </div>
            </th>
            <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-normal">Opponent</th>
            <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-medium whitespace-nowrap">Result</th>
            <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-normal">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary-text/50">
          {filteredImprovements.map((imp, idx) => {
            const setStrings =
              imp.game.score?.setPoints?.map((set) =>
                imp.game.winner === imp.playerId
                  ? `${set.gameWinner}-${set.gameLoser}`
                  : `${set.gameLoser}-${set.gameWinner}`,
              ) ?? [];
            // Max 3 sets per line on tiny screens
            const setLines = Array.from({ length: Math.ceil(setStrings.length / 3) }, (_, i) =>
              setStrings.slice(i * 3, i * 3 + 3).join(", "),
            );
            return (
            <tr key={idx} className="text-xs xs:text-sm md:text-base">
              <td className="py-1 px-1 xs:px-2 md:px-3 w-[35%] max-w-0">
                <button
                  onClick={() => setPlayerFilter(imp.playerId)}
                  className="flex items-center gap-1 md:gap-2 font-medium hover:underline min-w-0 w-full text-left"
                >
                  <div className="md:hidden shrink-0"><ProfilePicture playerId={imp.playerId} size={18} border={1} shape="rounded" /></div>
                  <div className="hidden md:block shrink-0"><ProfilePicture playerId={imp.playerId} size={30} border={2} shape="rounded" /></div>
                  <span className="truncate">{context.playerName(imp.playerId)}</span>
                </button>
              </td>
              <td className="py-1 px-1 xs:px-2 md:px-3 text-right font-bold w-[1%] whitespace-nowrap">
                +{fmtNum(imp.improvement)}
              </td>
              <td className="py-1 px-1 xs:px-2 md:px-3 w-[35%] max-w-0">
                <button
                  onClick={() => setOpponentFilter(imp.opponentId)}
                  className="flex items-center gap-1 md:gap-2 hover:underline min-w-0 w-full text-left"
                >
                  <div className="md:hidden shrink-0"><ProfilePicture playerId={imp.opponentId} size={18} border={1} shape="rounded" /></div>
                  <div className="hidden md:block shrink-0"><ProfilePicture playerId={imp.opponentId} size={30} border={2} shape="rounded" /></div>
                  <span className="truncate">{context.playerName(imp.opponentId)}</span>
                </button>
              </td>
              <td className="py-1 px-1 xs:px-2 md:px-3 w-[1%] whitespace-nowrap">
                {/* Tiny screens: sets on top, per-set points below (max 3 sets per line). xs+: inline. */}
                <div className="flex flex-col xs:flex-row xs:flex-wrap xs:items-baseline xs:gap-x-2">
                  {imp.game.score && (
                    <span className="font-medium">
                      {imp.game.winner === imp.playerId
                        ? `${imp.game.score?.setsWon.gameWinner} - ${imp.game.score?.setsWon.gameLoser}`
                        : `${imp.game.score?.setsWon.gameLoser} - ${imp.game.score?.setsWon.gameWinner}`}
                      <PointSequenceMarker score={imp.game.score} />
                    </span>
                  )}
                  {setStrings.length > 0 && (
                    <>
                      <span className="xs:hidden text-xs opacity-70">
                        {setLines.map((line, lineIndex) => (
                          <span key={lineIndex} className="block whitespace-nowrap">
                            {line}
                          </span>
                        ))}
                      </span>
                      <span className="hidden xs:inline text-xs opacity-70 whitespace-nowrap">
                        {setStrings.join(", ")}
                      </span>
                    </>
                  )}
                </div>
              </td>
              <td className="py-1 px-1 xs:px-2 md:px-3 text-xs md:text-sm opacity-70 w-[1%] whitespace-nowrap">
                <div className="flex flex-col">
                  <span className="whitespace-nowrap">{dateString(imp.time)}</span>
                  <span className="opacity-50 whitespace-nowrap">
                    <RelativeTime date={new Date(imp.time)} variant="auto" />
                  </span>
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
