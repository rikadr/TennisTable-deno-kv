import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { TennisTable } from "../../client/client-db/tennis-table";
import { EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { ProfilePicture } from "../player/profile-picture";

type SortBy = "start" | "end";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Convert a millisecond timestamp into the local "YYYY-MM-DDTHH:mm" string
// expected by a <input type="datetime-local"> element.
function toDatetimeLocalValue(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// A datetime-local string parses as local time. Returns undefined while the
// input is incomplete (the browser then reports an empty value).
function fromDatetimeLocalValue(value: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return isNaN(ms) ? undefined : ms;
}

type DiffRow = {
  playerId: string;
  startRank?: number;
  endRank?: number;
  startElo?: number;
  endElo?: number;
};

function useLeaderboardAt(time: number | undefined) {
  const context = useEventDbContext();
  return useMemo(() => {
    if (time === undefined) return undefined;
    // Same "state at a point in time" filter as tournament predictions:
    // games count by when they were played, everything else by event time.
    const eventsUpToTime = context.events.filter((event) => {
      if (event.type === EventTypeEnum.GAME_CREATED) {
        return event.data.playedAt <= time;
      }
      return event.time <= time;
    });
    return new TennisTable({ events: eventsUpToTime, referenceTime: time }).leaderboard.getLeaderboard();
  }, [context, time]);
}

const DeltaCell: React.FC<{ delta?: number; digits?: number }> = ({ delta, digits = 0 }) => {
  if (delta === undefined) return <span className="text-primary-text/40">–</span>;
  if (Math.round(delta) === 0) return <span className="text-primary-text/60">0</span>;
  return (
    <span className={classNames("font-medium", delta > 0 ? "text-green-500" : "text-red-500")}>
      {fmtNum(delta, { digits, signedPositive: true })}
    </span>
  );
};

export const WhatChangedPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();

  const [initialNow] = useState(() => Date.now());
  const [fromValue, setFromValue] = useState(() => toDatetimeLocalValue(initialNow - WEEK_MS));
  const [toValue, setToValue] = useState(() => toDatetimeLocalValue(initialNow));
  const [sortBy, setSortBy] = useState<SortBy>("end");

  const fromMs = fromDatetimeLocalValue(fromValue);
  const toMs = fromDatetimeLocalValue(toValue);
  const timesReversed = fromMs !== undefined && toMs !== undefined && fromMs > toMs;
  const startTime = timesReversed ? toMs : fromMs;
  const endTime = timesReversed ? fromMs : toMs;

  const startLeaderboard = useLeaderboardAt(startTime);
  const endLeaderboard = useLeaderboardAt(endTime);

  const rows = useMemo(() => {
    const rowMap = new Map<string, DiffRow>();
    startLeaderboard?.rankedPlayers.forEach((player) => {
      rowMap.set(player.id, { playerId: player.id, startRank: player.rank, startElo: player.elo });
    });
    endLeaderboard?.rankedPlayers.forEach((player) => {
      const row = rowMap.get(player.id) ?? { playerId: player.id };
      row.endRank = player.rank;
      row.endElo = player.elo;
      rowMap.set(player.id, row);
    });

    const sortRank = (row: DiffRow) => (sortBy === "start" ? row.startRank : row.endRank) ?? Infinity;
    const fallbackRank = (row: DiffRow) => (sortBy === "start" ? row.endRank : row.startRank) ?? Infinity;
    return Array.from(rowMap.values()).sort((a, b) => sortRank(a) - sortRank(b) || fallbackRank(a) - fallbackRank(b));
  }, [startLeaderboard, endLeaderboard, sortBy]);

  return (
    <div className="w-full px-4 flex flex-col items-center">
      <div className="w-full max-w-2xl md:max-w-4xl">
        <div className="bg-primary-background rounded-lg w-full overflow-hidden">
          <h1 className="text-2xl md:text-4xl text-center mt-2 md:mt-4 text-primary-text">What changed</h1>
          <p className="text-center text-sm md:text-base text-primary-text/60 mb-1 md:mb-2">
            Leaderboard changes between two points in time
          </p>

          {/* Timestamp pickers */}
          <div className="flex flex-col xs:flex-row justify-center gap-2 xs:gap-4 px-4 py-2">
            <label className="flex flex-col text-xs font-medium text-primary-text/70 uppercase tracking-wide gap-1">
              Start
              <input
                type="datetime-local"
                value={fromValue}
                onChange={(e) => setFromValue(e.target.value)}
                className="px-3 py-2 rounded-lg bg-primary-background text-primary-text text-sm normal-case tracking-normal ring-1 ring-secondary-background focus:ring-2 focus:ring-secondary-text focus:outline-none"
              />
            </label>
            <label className="flex flex-col text-xs font-medium text-primary-text/70 uppercase tracking-wide gap-1">
              End
              <input
                type="datetime-local"
                value={toValue}
                onChange={(e) => setToValue(e.target.value)}
                className="px-3 py-2 rounded-lg bg-primary-background text-primary-text text-sm normal-case tracking-normal ring-1 ring-secondary-background focus:ring-2 focus:ring-secondary-text focus:outline-none"
              />
            </label>
          </div>
          {timesReversed && (
            <p className="text-center text-xs text-primary-text/60 pb-1">
              The start is after the end, so the two times are swapped.
            </p>
          )}

          {/* Sort toggle */}
          <div className="flex justify-center items-center gap-2 px-4 py-2 border-b border-primary-text/20">
            <span className="text-xs md:text-sm text-primary-text/60">Sort by</span>
            {(
              [
                { value: "start", label: "Rank at start" },
                { value: "end", label: "Rank at end" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSortBy(value)}
                className={classNames(
                  "px-4 py-2 md:px-6 rounded text-sm md:text-base font-medium transition-colors ring-1",
                  sortBy === value
                    ? "bg-secondary-background text-secondary-text ring-secondary-text"
                    : "bg-primary-background text-primary-text ring-secondary-background hover:opacity-80",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="p-8 text-center text-primary-text/60">No ranked players at either time</div>
          ) : (
            <table className="w-full text-primary-text border-collapse">
              <thead className="border-b border-primary-text/50">
                <tr className="text-xs md:text-sm text-primary-text/60">
                  <th></th>
                  <th colSpan={3} className="py-1 text-center font-medium border-l border-primary-text/20">
                    Rank
                  </th>
                  <th colSpan={3} className="py-1 text-center font-medium border-l border-primary-text/20">
                    Score
                  </th>
                </tr>
                <tr className="text-xs xs:text-sm md:text-base text-primary-text">
                  <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-medium">Player</th>
                  <th className="py-1 px-1 md:px-2 text-right font-medium border-l border-primary-text/20">Start</th>
                  <th className="py-1 px-1 md:px-2 text-right font-medium">End</th>
                  <th className="py-1 px-1 md:px-2 text-right font-medium">Δ</th>
                  <th className="py-1 px-1 md:px-2 text-right font-medium border-l border-primary-text/20">Start</th>
                  <th className="py-1 px-1 md:px-2 text-right font-medium">End</th>
                  <th className="py-1 px-1 xs:px-2 md:px-3 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-text/50 text-xs xs:text-sm md:text-base">
                {rows.map((row) => {
                  const deltaRank =
                    row.startRank !== undefined && row.endRank !== undefined
                      ? row.startRank - row.endRank
                      : undefined;
                  const deltaElo =
                    row.startElo !== undefined && row.endElo !== undefined ? row.endElo - row.startElo : undefined;
                  return (
                    <tr
                      key={row.playerId}
                      onClick={() => navigate(`/player/${row.playerId}`)}
                      className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors"
                    >
                      <td className="py-1 px-1 xs:px-2 md:px-3 max-w-0 w-full">
                        <div className="flex items-center gap-1 md:gap-2 min-w-0">
                          <ProfilePicture playerId={row.playerId} size={24} border={2} />
                          <span className="font-medium truncate">{context.playerName(row.playerId)}</span>
                        </div>
                      </td>
                      <td className="py-1 px-1 md:px-2 text-right whitespace-nowrap border-l border-primary-text/20">
                        {row.startRank ?? <span className="text-primary-text/40">–</span>}
                      </td>
                      <td className="py-1 px-1 md:px-2 text-right whitespace-nowrap">
                        {row.endRank ?? <span className="text-primary-text/40">–</span>}
                      </td>
                      <td className="py-1 px-1 md:px-2 text-right whitespace-nowrap">
                        <DeltaCell delta={deltaRank} />
                      </td>
                      <td className="py-1 px-1 md:px-2 text-right whitespace-nowrap border-l border-primary-text/20">
                        {row.startElo !== undefined ? (
                          fmtNum(row.startElo, { digits: 0 })
                        ) : (
                          <span className="text-primary-text/40">–</span>
                        )}
                      </td>
                      <td className="py-1 px-1 md:px-2 text-right whitespace-nowrap">
                        {row.endElo !== undefined ? (
                          fmtNum(row.endElo, { digits: 0 })
                        ) : (
                          <span className="text-primary-text/40">–</span>
                        )}
                      </td>
                      <td className="py-1 px-1 xs:px-2 md:px-3 text-right whitespace-nowrap">
                        <DeltaCell delta={deltaElo} />
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
