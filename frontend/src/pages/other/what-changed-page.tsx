import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@headlessui/react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { TennisTable } from "../../client/client-db/tennis-table";
import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { WorkerMessage } from "../../client/client-db/web-worker/web-worker";
import { createModernWorker } from "../../hooks/use-elo-simulation-worker";
import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { RelativeTime } from "../../common/date-utils";
import { Game } from "../../client/client-db/event-store/projectors/games-projector";
import { ProfilePicture } from "../player/profile-picture";

type SortBy = "start" | "end";
type Source = "actual" | "expected";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const GAMES_PAGE_SIZE = 50;

// One shared column template so the header rows and every player row line up.
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem_2.5rem_3rem_3rem_3.25rem] md:grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3.5rem_4.5rem_4.5rem_4.5rem] items-center";
const NUM_CELL = "self-stretch flex items-center justify-end py-1 px-1 md:px-2 whitespace-nowrap";

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
  startScore?: number;
  endScore?: number;
};

type RankedEntry = { id: string; rank: number; score: number };

// Same "state at a point in time" filter as tournament predictions:
// games count by when they were played, everything else by event time.
function eventsUpTo(events: EventType[], time: number): EventType[] {
  return events.filter((event) => {
    if (event.type === EventTypeEnum.GAME_CREATED) {
      return event.data.playedAt <= time;
    }
    return event.time <= time;
  });
}

function useLeaderboardAt(time: number | undefined): RankedEntry[] | undefined {
  const context = useEventDbContext();
  return useMemo(() => {
    if (time === undefined) return undefined;
    const state = new TennisTable({ events: eventsUpTo(context.events, time), referenceTime: time });
    return state.leaderboard.getLeaderboard().rankedPlayers.map(({ id, rank, elo }) => ({ id, rank, score: elo }));
  }, [context, time]);
}

function useExpectedLeaderboardAt(time: number | undefined, enabled: boolean) {
  const context = useEventDbContext();
  const cacheRef = useRef<Map<number, RankedEntry[]>>(new Map());
  const [computed, setComputed] = useState<{ time: number; entries: RankedEntry[] } | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled || time === undefined) return;
    const cached = cacheRef.current.get(time);
    if (cached) {
      setComputed({ time, entries: cached });
      return;
    }
    setProgress(0);
    let worker: Worker | null = null;
    // Debounce so half-edited datetime inputs do not start 5 000 simulations.
    const debounce = setTimeout(() => {
      const events = eventsUpTo(context.events, time);
      worker = createModernWorker();

      if (!worker) {
        // Fallback: run on the main thread if workers are unavailable
        const result = new TennisTable({ events, referenceTime: time }).simulations.expectedLeaderBoard();
        cacheRef.current.set(time, result.expected);
        setComputed({ time, entries: result.expected });
        return;
      }

      worker.addEventListener("message", (e) => {
        const message = e.data as WorkerMessage;
        switch (message.type) {
          case "expected-leaderboard-progress":
            setProgress(message.data.progress);
            break;

          case "expected-leaderboard-result":
            cacheRef.current.set(time, message.data.result.expected);
            setComputed({ time, entries: message.data.result.expected });
            break;
        }
      });

      const message: WorkerMessage = { type: "start-expected-leaderboard", data: { events, referenceTime: time } };
      worker.postMessage(message);
    }, 500);

    return () => {
      clearTimeout(debounce);
      worker?.terminate();
    };
  }, [context, time, enabled]);

  const entries = computed !== null && computed.time === time ? computed.entries : undefined;
  return { entries, progress, loading: enabled && time !== undefined && entries === undefined };
}

// Labeled pill switch in the style of the tournament tree/list toggle.
// `checked` selects the right-hand option.
const PillToggle: React.FC<{
  label: string;
  leftLabel: string;
  rightLabel: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, leftLabel, rightLabel, checked, onChange }) => (
  <div className="flex flex-col items-center gap-1">
    <span className="text-xs md:text-sm text-primary-text/60">{label}</span>
    <Switch
      checked={checked}
      onChange={onChange}
      className="group relative flex h-10 w-40 cursor-pointer rounded-full bg-secondary-background p-1 transition-colors duration-200 ease-in-out focus:outline-none data-[focus]:outline-1 data-[focus]:outline-white"
    >
      <span
        className={classNames(
          "z-10 flex w-1/2 items-center justify-center text-sm",
          checked ? "text-secondary-text" : "text-primary-text",
        )}
      >
        {leftLabel}
      </span>
      <span
        className={classNames(
          "z-10 flex w-1/2 items-center justify-center text-sm",
          checked ? "text-primary-text" : "text-secondary-text",
        )}
      >
        {rightLabel}
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1 top-1 h-8 w-[4.75rem] rounded-full bg-primary-background shadow-lg ring-0 transition duration-200 ease-in-out group-data-[checked]:translate-x-[4.75rem]"
      />
    </Switch>
  </div>
);

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
  const [source, setSource] = useState<Source>("actual");

  const fromMs = fromDatetimeLocalValue(fromValue);
  const toMs = fromDatetimeLocalValue(toValue);
  const timesReversed = fromMs !== undefined && toMs !== undefined && fromMs > toMs;
  const startTime = timesReversed ? toMs : fromMs;
  const endTime = timesReversed ? fromMs : toMs;

  const startActual = useLeaderboardAt(source === "actual" ? startTime : undefined);
  const endActual = useLeaderboardAt(source === "actual" ? endTime : undefined);
  const startExpected = useExpectedLeaderboardAt(startTime, source === "expected");
  const endExpected = useExpectedLeaderboardAt(endTime, source === "expected");

  const startEntries = source === "actual" ? startActual : startExpected.entries;
  const endEntries = source === "actual" ? endActual : endExpected.entries;
  const simulating = source === "expected" && (startExpected.loading || endExpected.loading);
  const simulationProgress = (startExpected.loading ? startExpected.progress : 1) *
    0.5 + (endExpected.loading ? endExpected.progress : 1) * 0.5;

  const rows = useMemo(() => {
    const rowMap = new Map<string, DiffRow>();
    startEntries?.forEach((player) => {
      rowMap.set(player.id, { playerId: player.id, startRank: player.rank, startScore: player.score });
    });
    endEntries?.forEach((player) => {
      const row = rowMap.get(player.id) ?? { playerId: player.id };
      row.endRank = player.rank;
      row.endScore = player.score;
      rowMap.set(player.id, row);
    });

    const sortRank = (row: DiffRow) => (sortBy === "start" ? row.startRank : row.endRank) ?? Infinity;
    const fallbackRank = (row: DiffRow) => (sortBy === "start" ? row.endRank : row.startRank) ?? Infinity;
    return Array.from(rowMap.values()).sort((a, b) => sortRank(a) - sortRank(b) || fallbackRank(a) - fallbackRank(b));
  }, [startEntries, endEntries, sortBy]);

  // The DOM order of the rows stays fixed and the CSS `order` property places
  // them, so a sort or source change animates the rows to their new positions
  // (the season charts bars technique).
  const stableRows = useMemo(() => [...rows].sort((a, b) => a.playerId.localeCompare(b.playerId)), [rows]);
  const visualOrder = new Map(rows.map((row, index) => [row.playerId, index + 1]));

  // Games played between the two times, newest first. Always the actual
  // games - the source toggle only changes the leaderboard table.
  const gamesInWindow = useMemo(() => {
    if (startTime === undefined || endTime === undefined) return [];
    return context.games.filter((game) => game.playedAt >= startTime && game.playedAt <= endTime).toReversed();
  }, [context, startTime, endTime]);
  const [visibleGames, setVisibleGames] = useState(GAMES_PAGE_SIZE);
  const leaderboardMap = context.leaderboard.getCachedLeaderboardMap();
  const eloWonInGame = (game: Game) =>
    leaderboardMap.get(game.winner)?.games.find((g) => g.time === game.playedAt)?.pointsDiff;

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

          {/* Sort + source toggles */}
          <div className="flex justify-center items-end gap-4 xs:gap-8 px-4 py-2 border-b border-primary-text/20">
            <PillToggle
              label="Sort by rank at"
              leftLabel="Start"
              rightLabel="End"
              checked={sortBy === "end"}
              onChange={(checked) => setSortBy(checked ? "end" : "start")}
            />
            <PillToggle
              label="Leaderboard"
              leftLabel="Actual"
              rightLabel="Expected"
              checked={source === "expected"}
              onChange={(checked) => setSource(checked ? "expected" : "actual")}
            />
          </div>

          {simulating ? (
            <div className="max-w-md mx-auto p-6 text-center">
              <p className="text-primary-text/60 text-sm mb-4">Simulating 2 × 5 000 leaderboards…</p>
              <div className="h-2.5 w-full rounded-full bg-primary-text/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-secondary-background transition-all duration-150"
                  style={{ width: `${Math.round(simulationProgress * 100)}%` }}
                />
              </div>
              <p className="text-primary-text/60 text-xs mt-2">{Math.round(simulationProgress * 100)} %</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-primary-text/60">No ranked players at either time</div>
          ) : (
            <div className="flex flex-col text-primary-text">
              <div className={classNames(ROW_GRID, "text-xs md:text-sm text-primary-text/60")}>
                <div />
                <div className="col-span-3 self-stretch flex items-center justify-center py-1 font-medium border-l border-primary-text/20">
                  Rank
                </div>
                <div className="col-span-3 self-stretch flex items-center justify-center py-1 font-medium border-l border-primary-text/20">
                  Score
                </div>
              </div>
              <div className={classNames(ROW_GRID, "text-xs xs:text-sm md:text-base border-b border-primary-text/50")}>
                <div className="py-1 px-1 xs:px-2 md:px-3 font-medium">Player</div>
                <div className={classNames(NUM_CELL, "font-medium border-l border-primary-text/20")}>Start</div>
                <div className={classNames(NUM_CELL, "font-medium")}>End</div>
                <div className={classNames(NUM_CELL, "font-medium")}>Δ</div>
                <div className={classNames(NUM_CELL, "font-medium border-l border-primary-text/20")}>Start</div>
                <div className={classNames(NUM_CELL, "font-medium")}>End</div>
                <div className={classNames(NUM_CELL, "font-medium md:px-3")}>Δ</div>
              </div>
              {stableRows.map((row) => {
                const deltaRank =
                  row.startRank !== undefined && row.endRank !== undefined ? row.startRank - row.endRank : undefined;
                const deltaScore =
                  row.startScore !== undefined && row.endScore !== undefined
                    ? row.endScore - row.startScore
                    : undefined;
                return (
                  <div
                    key={row.playerId}
                    style={{ order: visualOrder.get(row.playerId) }}
                    onClick={() => navigate(`/player/${row.playerId}`)}
                    className={classNames(
                      ROW_GRID,
                      "text-xs xs:text-sm md:text-base transition-all duration-500 border-b border-primary-text/50",
                      "bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer",
                    )}
                  >
                    <div className="py-1 px-1 xs:px-2 md:px-3 min-w-0 flex items-center gap-1 md:gap-2">
                      <ProfilePicture playerId={row.playerId} size={24} border={2} />
                      <span className="font-medium truncate">{context.playerName(row.playerId)}</span>
                    </div>
                    <div className={classNames(NUM_CELL, "border-l border-primary-text/20")}>
                      {row.startRank ?? <span className="text-primary-text/40">–</span>}
                    </div>
                    <div className={NUM_CELL}>{row.endRank ?? <span className="text-primary-text/40">–</span>}</div>
                    <div className={NUM_CELL}>
                      <DeltaCell delta={deltaRank} />
                    </div>
                    <div className={classNames(NUM_CELL, "border-l border-primary-text/20")}>
                      {row.startScore !== undefined ? (
                        fmtNum(row.startScore, { digits: 0 })
                      ) : (
                        <span className="text-primary-text/40">–</span>
                      )}
                    </div>
                    <div className={NUM_CELL}>
                      {row.endScore !== undefined ? (
                        fmtNum(row.endScore, { digits: 0 })
                      ) : (
                        <span className="text-primary-text/40">–</span>
                      )}
                    </div>
                    <div className={classNames(NUM_CELL, "md:px-3")}>
                      <DeltaCell delta={deltaScore} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Games played between the two times */}
          <div className="mt-4 border-t border-primary-text/20">
            <h2 className="text-lg md:text-2xl text-center mt-2 text-primary-text">Games played</h2>
            <p className="text-center text-sm md:text-base text-primary-text/60 mb-1 md:mb-2">
              {gamesInWindow.length} {gamesInWindow.length === 1 ? "game" : "games"} between the two times
            </p>

            {gamesInWindow.length > 0 && (
              <table className="w-full text-primary-text border-collapse">
                <thead className="border-b border-primary-text/50">
                  <tr className="text-xs xs:text-sm md:text-base text-primary-text">
                    <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-medium">🏆 Winner</th>
                    <th className="py-1 px-1 md:px-2 text-center font-medium whitespace-nowrap">Score</th>
                    <th className="py-1 px-1 xs:px-2 md:px-3 text-right font-medium">Loser 💔</th>
                    <th className="py-1 px-1 xs:px-2 md:px-3 text-right font-medium whitespace-nowrap">Elo won</th>
                    <th className="py-1 px-1 xs:px-2 md:px-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-text/50 text-xs xs:text-sm md:text-base">
                  {gamesInWindow.slice(0, visibleGames).map((game) => {
                    const eloWon = eloWonInGame(game);
                    return (
                      <tr
                        key={game.id}
                        onClick={() => navigate(`/1v1?player1=${game.winner}&player2=${game.loser}`)}
                        className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors"
                      >
                        <td className="py-1 px-1 xs:px-2 md:px-3 w-[35%] max-w-0">
                          <div className="flex items-center gap-1 md:gap-2 min-w-0">
                            <ProfilePicture playerId={game.winner} size={24} border={2} />
                            <span className="font-medium truncate">{context.playerName(game.winner)}</span>
                          </div>
                        </td>
                        <td className="py-1 px-1 md:px-2 text-center whitespace-nowrap w-[1%]">
                          {game.score ? (
                            <div className="leading-tight -my-1">
                              <div className="font-medium">
                                {game.score.setsWon.gameWinner} - {game.score.setsWon.gameLoser}
                              </div>
                              {game.score.setPoints && (
                                <div className="font-light italic text-[10px] md:text-xs whitespace-nowrap leading-none">
                                  {game.score.setPoints.map((set) => `${set.gameWinner}-${set.gameLoser}`).join(", ")}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td className="py-1 px-1 xs:px-2 md:px-3 w-[35%] max-w-0">
                          <div className="flex items-center justify-end gap-1 md:gap-2 min-w-0">
                            <span className="font-medium truncate">{context.playerName(game.loser)}</span>
                            <ProfilePicture playerId={game.loser} size={24} border={2} />
                          </div>
                        </td>
                        <td className="py-1 px-1 xs:px-2 md:px-3 text-right font-medium w-[1%] whitespace-nowrap">
                          {eloWon !== undefined ? `+${fmtNum(eloWon, { digits: 0 })}` : "-"}
                        </td>
                        <td className="py-1 px-1 xs:px-2 md:px-3 text-right whitespace-nowrap w-[1%]">
                          <RelativeTime date={new Date(game.playedAt)} variant="auto" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {gamesInWindow.length > visibleGames && (
              <div className="flex justify-center py-4 border-t border-primary-text/20">
                <button
                  onClick={() => setVisibleGames((prev) => prev + GAMES_PAGE_SIZE)}
                  className="px-6 py-2 rounded text-sm font-medium transition-colors ring-1 bg-secondary-background text-secondary-text ring-secondary-text hover:opacity-80"
                >
                  Load {Math.min(GAMES_PAGE_SIZE, gamesInWindow.length - visibleGames)} more games
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
