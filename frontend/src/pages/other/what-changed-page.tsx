import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { TennisTable } from "../../client/client-db/tennis-table";
import { WorkerMessage } from "../../client/client-db/web-worker/web-worker";
import { createModernWorker } from "../../hooks/use-elo-simulation-worker";
import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { fromDatetimeLocalValue, RelativeTime, toDatetimeLocalValue } from "../../common/date-utils";
import { eventsUpTo, useStateAt } from "../../hooks/use-state-at";
import { PointSequenceMarker } from "../game/point-sequence-marker";
import { Game } from "../../client/client-db/event-store/projectors/games-projector";
import { Achievement } from "../../client/client-db/achievements";
import { getAchievementLabel } from "../player/player-achievements";
import { ProfilePicture } from "../player/profile-picture";

type SortBy = "start" | "end" | "delta";
type Source = "actual" | "expected";

type Tab = "leaderboards" | "games" | "achievements";
const TABS: { id: Tab; label: string }[] = [
  { id: "leaderboards", label: "Leaderboards" },
  { id: "games", label: "Games" },
  { id: "achievements", label: "Achievements" },
];

type LeaderboardTab = "overall" | "season" | "hall-of-fame";
const LEADERBOARD_TABS: { id: LeaderboardTab; label: string }[] = [
  { id: "overall", label: "Overall" },
  { id: "season", label: "Season" },
  { id: "hall-of-fame", label: "Hall of Fame" },
];

type QuickRange = "last-game" | "today" | "7-days" | "30-days" | "365-days" | "custom";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const GAMES_PAGE_SIZE = 50;
const ACHIEVEMENTS_PAGE_SIZE = 50;

// One shared column template so the header rows and every player row line up.
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem_2.5rem_3rem_3rem_3.25rem] md:grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3.5rem_4.5rem_4.5rem_4.5rem] items-center";
const NUM_CELL = "self-stretch flex items-center justify-end py-1 px-1 md:px-2 whitespace-nowrap";

type DiffRow = {
  playerId: string;
  startRank?: number;
  endRank?: number;
  startScore?: number;
  endScore?: number;
};

type RankedEntry = { id: string; rank: number; score: number };

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timeout);
  }, [value, ms]);
  return debounced;
}

// The leaderboard of one season (identified by its start time) as it stood in
// a projected state. An empty list means the season had no games yet at that
// time; undefined means the state itself is not available.
function seasonEntriesAt(state: TennisTable | undefined, seasonStart: number): RankedEntry[] | undefined {
  if (!state) return undefined;
  const season = state.seasons.getSeasons().find((s) => s.start === seasonStart);
  if (!season) return [];
  return season.getLeaderboard().map((player, index) => ({
    id: player.playerId,
    rank: index + 1,
    score: player.seasonScore,
  }));
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

// Labeled pill selector in the style of the tournament tree/list toggle,
// generalized to any number of options: a knob slides to the selected one.
function PillSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs md:text-sm text-primary-text/60">{label}</span>
      <div
        className={classNames(
          "relative flex h-10 rounded-full bg-secondary-background p-1",
          // Three options need more room than two, so the texts keep some
          // space between each other and to the ends of the pill.
          options.length > 2 ? "w-52" : "w-40",
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-primary-background shadow-lg transition-transform duration-200 ease-in-out"
          style={{
            width: `calc((100% - 0.5rem) / ${options.length})`,
            transform: `translateX(${selectedIndex * 100}%)`,
          }}
        />
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={classNames(
              "z-10 flex-1 flex items-center justify-center px-2 text-xs xs:text-sm whitespace-nowrap rounded-full focus:outline-none",
              option.value === value ? "text-primary-text" : "text-secondary-text",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const DeltaCell: React.FC<{ delta?: number; digits?: number }> = ({ delta, digits = 0 }) => {
  if (delta === undefined) return <span className="text-primary-text/40">–</span>;
  if (Number(delta.toFixed(digits)) === 0) return <span className="text-primary-text/60">0</span>;
  return (
    <span className={classNames("font-medium", delta > 0 ? "text-green-500" : "text-red-500")}>
      {fmtNum(delta, { digits, signedPositive: true })}
    </span>
  );
};

// Rank + score diff table between the two times. The DOM order of the rows
// stays fixed and the CSS `order` property places them, so a sort or source
// change animates the rows to their new positions (the season charts bars
// technique).
const DiffTable: React.FC<{
  startEntries?: RankedEntry[];
  endEntries?: RankedEntry[];
  sortBy: SortBy;
  emptyText: string;
  scoreDigits?: number;
  onRowClick: (playerId: string) => void;
}> = ({ startEntries, endEntries, sortBy, emptyText, scoreDigits = 0, onRowClick }) => {
  const context = useEventDbContext();

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

    const list = Array.from(rowMap.values());

    if (sortBy === "delta") {
      // Biggest score gain first; rows without a delta go to the bottom.
      const scoreDelta = (row: DiffRow) =>
        row.startScore !== undefined && row.endScore !== undefined ? row.endScore - row.startScore : -Infinity;
      return list.sort((a, b) => scoreDelta(b) - scoreDelta(a) || (a.endRank ?? Infinity) - (b.endRank ?? Infinity));
    }

    const sortRank = (row: DiffRow) => (sortBy === "start" ? row.startRank : row.endRank) ?? Infinity;
    const fallbackRank = (row: DiffRow) => (sortBy === "start" ? row.endRank : row.startRank) ?? Infinity;
    return list.sort((a, b) => sortRank(a) - sortRank(b) || fallbackRank(a) - fallbackRank(b));
  }, [startEntries, endEntries, sortBy]);

  const stableRows = useMemo(() => [...rows].sort((a, b) => a.playerId.localeCompare(b.playerId)), [rows]);
  const visualOrder = new Map(rows.map((row, index) => [row.playerId, index + 1]));

  if (rows.length === 0) {
    return <div className="p-8 text-center text-primary-text/60">{emptyText}</div>;
  }

  return (
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
          row.startScore !== undefined && row.endScore !== undefined ? row.endScore - row.startScore : undefined;
        return (
          <div
            key={row.playerId}
            style={{ order: visualOrder.get(row.playerId) }}
            onClick={() => onRowClick(row.playerId)}
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
                fmtNum(row.startScore, { digits: scoreDigits })
              ) : (
                <span className="text-primary-text/40">–</span>
              )}
            </div>
            <div className={NUM_CELL}>
              {row.endScore !== undefined ? (
                fmtNum(row.endScore, { digits: scoreDigits })
              ) : (
                <span className="text-primary-text/40">–</span>
              )}
            </div>
            <div className={classNames(NUM_CELL, "md:px-3")}>
              <DeltaCell delta={deltaScore} digits={scoreDigits} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const WhatChangedPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();

  // Every selection on the page lives in the URL, so navigating away and
  // back restores the same view. Defaults are not written to the URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const setParams = (updates: Record<string, string | undefined>, replace = false) => {
    setSearchParams(
      (prev) => {
        const newParams = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => {
          if (value === undefined) newParams.delete(key);
          else newParams.set(key, value);
        });
        return newParams;
      },
      { replace },
    );
  };
  const tabParam = searchParams.get("tab");
  const activeTab: Tab = TABS.some((tab) => tab.id === tabParam) ? (tabParam as Tab) : "games";
  const leaderboardParam = searchParams.get("leaderboard");
  const leaderboardTab: LeaderboardTab = LEADERBOARD_TABS.some((tab) => tab.id === leaderboardParam)
    ? (leaderboardParam as LeaderboardTab)
    : "overall";
  const sortParam = searchParams.get("sort");
  const sortBy: SortBy = sortParam === "start" || sortParam === "delta" ? sortParam : "end";
  const source: Source = searchParams.get("source") === "expected" ? "expected" : "actual";

  // Fixed at mount and refreshed when a quick range is clicked, so the quick
  // windows do not drift while the page stays open.
  const [now, setNow] = useState(() => Date.now());

  // Quick select of common periods, all ending now. The inputs have second
  // resolution, so the last-game window starts 1 ms before the game: the
  // truncated second is then strictly before the game and the game itself
  // falls inside the window. "custom" has no start - it reveals the two
  // datetime inputs and keeps their current values.
  const lastGame = context.games.at(-1);
  const quickRanges: { id: QuickRange; label: string; start?: (now: number) => number }[] = [
    ...(lastGame ? [{ id: "last-game" as const, label: "Last game", start: () => lastGame.playedAt - 1 }] : []),
    { id: "today", label: "Today", start: (now: number) => new Date(now).setHours(0, 0, 0, 0) },
    { id: "7-days", label: "Last 7 days", start: (now: number) => now - 7 * DAY_MS },
    { id: "30-days", label: "Last 30 days", start: (now: number) => now - 30 * DAY_MS },
    { id: "365-days", label: "Last 365 days", start: (now: number) => now - 365 * DAY_MS },
    { id: "custom", label: "Custom" },
  ];
  const rangeParam = searchParams.get("range");
  const selectedRange: QuickRange = quickRanges.some((range) => range.id === rangeParam)
    ? (rangeParam as QuickRange)
    : "today";

  // A quick range stays relative in the URL - reopening it computes the
  // window from the current time. The custom range keeps its two absolute
  // timestamps in the from/to params instead.
  const selectedQuickStart = quickRanges.find((range) => range.id === selectedRange)?.start;
  const fromValue =
    selectedRange === "custom"
      ? (searchParams.get("from") ?? toDatetimeLocalValue(now - WEEK_MS))
      : toDatetimeLocalValue(selectedQuickStart ? selectedQuickStart(now) : now - WEEK_MS);
  const toValue =
    selectedRange === "custom" ? (searchParams.get("to") ?? toDatetimeLocalValue(now)) : toDatetimeLocalValue(now);

  const selectQuickRange = (range: (typeof quickRanges)[number]) => {
    if (range.id === "custom") {
      // Seed the custom inputs with the window of the quick range they replace.
      setParams({ range: "custom", from: fromValue, to: toValue });
      return;
    }
    setNow(Date.now());
    setParams({ range: range.id, from: undefined, to: undefined });
  };

  const fromMs = fromDatetimeLocalValue(fromValue);
  const toMs = fromDatetimeLocalValue(toValue);
  const timesReversed = fromMs !== undefined && toMs !== undefined && fromMs > toMs;
  // Debounced so typing in a datetime input does not rebuild the projections
  // on every keystroke.
  const startTime = useDebounced(timesReversed ? toMs : fromMs, 300);
  const endTime = useDebounced(timesReversed ? fromMs : toMs, 300);

  const startState = useStateAt(startTime);
  const endState = useStateAt(endTime);

  const startActual = useMemo(
    () => startState?.leaderboard.getLeaderboard().rankedPlayers.map(({ id, rank, elo }) => ({ id, rank, score: elo })),
    [startState],
  );
  const endActual = useMemo(
    () => endState?.leaderboard.getLeaderboard().rankedPlayers.map(({ id, rank, elo }) => ({ id, rank, score: elo })),
    [endState],
  );
  // The expected leaderboard is only shown on the overall leaderboard tab, so
  // only simulate there.
  const simulationNeeded = source === "expected" && activeTab === "leaderboards" && leaderboardTab === "overall";
  const startExpected = useExpectedLeaderboardAt(startTime, simulationNeeded);
  const endExpected = useExpectedLeaderboardAt(endTime, simulationNeeded);

  const simulating = simulationNeeded && (startExpected.loading || endExpected.loading);
  const simulationProgress =
    (startExpected.loading ? startExpected.progress : 1) * 0.5 + (endExpected.loading ? endExpected.progress : 1) * 0.5;

  // Hall of Fame score for every player, retired and active, at the two times.
  const startHallOfFame = useMemo(
    () =>
      startState?.hallOfFame
        .getFullHypotheticalLeaderboard()
        .map((entry, index) => ({ id: entry.playerId, rank: index + 1, score: entry.score.total })),
    [startState],
  );
  const endHallOfFame = useMemo(
    () =>
      endState?.hallOfFame
        .getFullHypotheticalLeaderboard()
        .map((entry, index) => ({ id: entry.playerId, rank: index + 1, score: entry.score.total })),
    [endState],
  );

  // Seasons that overlap the selected period. The season leaderboard diff is
  // only meaningful when the period touches exactly one season.
  const allSeasons = context.seasons.getSeasons();
  const seasonsInWindow = useMemo(() => {
    if (startTime === undefined || endTime === undefined) return [];
    return allSeasons.filter((season) => season.start < endTime && season.end > startTime);
  }, [allSeasons, startTime, endTime]);
  const singleSeason = seasonsInWindow.length === 1 ? seasonsInWindow[0] : undefined;
  const singleSeasonName = singleSeason ? `Season ${allSeasons.indexOf(singleSeason) + 1}` : undefined;
  const startSeasonEntries = useMemo(
    () => (singleSeason ? seasonEntriesAt(startState, singleSeason.start) : undefined),
    [startState, singleSeason],
  );
  const endSeasonEntries = useMemo(
    () => (singleSeason ? seasonEntriesAt(endState, singleSeason.start) : undefined),
    [endState, singleSeason],
  );

  // Achievements earned between the two times, newest first. Read from the
  // current full history - `earnedAt` records when each was earned.
  const achievementsInWindow = useMemo(() => {
    if (startTime === undefined || endTime === undefined) return [];
    context.achievements.calculateAchievements();
    const all: Achievement[] = [];
    context.achievements.achievementMap.forEach((playerAchievements) => all.push(...playerAchievements));
    return all
      .filter((achievement) => achievement.earnedAt >= startTime && achievement.earnedAt <= endTime)
      .sort((a, b) => b.earnedAt - a.earnedAt);
  }, [context, startTime, endTime]);
  const [visibleAchievements, setVisibleAchievements] = useState(ACHIEVEMENTS_PAGE_SIZE);

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
          <h1 className="text-2xl md:text-4xl text-center mt-2 md:mt-4 mb-1 md:mb-2 text-primary-text">
            What changed
          </h1>

          {/* Quick select of common periods */}
          <div className="flex flex-wrap justify-center gap-1.5 xs:gap-2 px-4 py-2">
            {quickRanges.map((range) => (
              <button
                key={range.id}
                onClick={() => selectQuickRange(range)}
                className={classNames(
                  "px-3 py-1 rounded-full text-xs md:text-sm ring-1 ring-secondary-background transition-colors whitespace-nowrap",
                  selectedRange === range.id
                    ? "bg-secondary-background text-secondary-text"
                    : "text-primary-text hover:bg-secondary-background hover:text-secondary-text",
                )}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Timestamp pickers, revealed by the Custom quick select */}
          {selectedRange === "custom" && (
            <>
              <div className="flex flex-col xs:flex-row justify-center gap-2 xs:gap-4 px-4 pb-2">
                <label className="flex flex-col text-xs font-medium text-primary-text/70 uppercase tracking-wide gap-1">
                  Start
                  <input
                    type="datetime-local"
                    step={1}
                    value={fromValue}
                    onChange={(e) => setParams({ from: e.target.value }, true)}
                    className="px-3 py-2 rounded-lg bg-primary-background text-primary-text text-sm normal-case tracking-normal ring-1 ring-secondary-background focus:ring-2 focus:ring-secondary-text focus:outline-none"
                  />
                </label>
                <label className="flex flex-col text-xs font-medium text-primary-text/70 uppercase tracking-wide gap-1">
                  End
                  <input
                    type="datetime-local"
                    step={1}
                    value={toValue}
                    onChange={(e) => setParams({ to: e.target.value }, true)}
                    className="px-3 py-2 rounded-lg bg-primary-background text-primary-text text-sm normal-case tracking-normal ring-1 ring-secondary-background focus:ring-2 focus:ring-secondary-text focus:outline-none"
                  />
                </label>
              </div>
              {timesReversed && (
                <p className="text-center text-xs text-primary-text/60 pb-1">
                  The start is after the end, so the two times are swapped.
                </p>
              )}
            </>
          )}

          {/* Tabs navigation */}
          <div className="flex justify-center space-x-2 overflow-x-auto flex-nowrap scrollbar-hide border-b border-primary-text/20 mt-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setParams({ tab: tab.id })}
                className={classNames(
                  "flex items-center py-2 px-4 border-b-4 font-medium text-sm transition-colors shrink-0 whitespace-nowrap",
                  activeTab === tab.id
                    ? "text-primary-text border-primary-text"
                    : "text-primary-text/80 border-transparent hover:text-primary-text hover:border-primary-text border-dotted",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "leaderboards" && (
            <>
              {/* Sub tabs between the three leaderboards */}
              <div className="flex justify-center space-x-2 overflow-x-auto flex-nowrap scrollbar-hide pt-1">
                {LEADERBOARD_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setParams({ leaderboard: tab.id })}
                    className={classNames(
                      "flex items-center py-2 px-4 border-b-4 font-medium text-sm transition-colors shrink-0 whitespace-nowrap",
                      leaderboardTab === tab.id
                        ? "text-primary-text border-primary-text"
                        : "text-primary-text/60 border-transparent hover:text-primary-text hover:border-primary-text border-dotted",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sort toggle for every leaderboard; the source toggle only
                  applies to the overall leaderboard */}
              <div className="flex justify-center items-end gap-4 xs:gap-8 px-4 py-2 border-b border-primary-text/20">
                <PillSelect<SortBy>
                  label="Sort by"
                  options={[
                    { value: "start", label: "# Start" },
                    { value: "end", label: "# End" },
                    { value: "delta", label: "Score Δ" },
                  ]}
                  value={sortBy}
                  onChange={(value) => setParams({ sort: value })}
                />
                {leaderboardTab === "overall" && (
                  <PillSelect<Source>
                    label="Leaderboard"
                    options={[
                      { value: "actual", label: "Actual" },
                      { value: "expected", label: "Expected" },
                    ]}
                    value={source}
                    onChange={(value) => setParams({ source: value })}
                  />
                )}
              </div>

              {/* Overall leaderboard changes between the two times */}
              {leaderboardTab === "overall" &&
                (simulating ? (
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
                ) : (
                  <DiffTable
                    startEntries={source === "actual" ? startActual : startExpected.entries}
                    endEntries={source === "actual" ? endActual : endExpected.entries}
                    sortBy={sortBy}
                    emptyText="No ranked players at either time"
                    onRowClick={(playerId) => navigate(`/player/${playerId}`)}
                  />
                ))}

              {/* Season leaderboard changes between the two times */}
              {leaderboardTab === "season" &&
                (singleSeason ? (
                  <>
                    <p className="text-center text-sm md:text-base text-primary-text/60 py-1 md:py-2">
                      {singleSeasonName}
                    </p>
                    <DiffTable
                      startEntries={startSeasonEntries}
                      endEntries={endSeasonEntries}
                      sortBy={sortBy}
                      emptyText="No season games at either time"
                      scoreDigits={1}
                      onRowClick={(playerId) =>
                        navigate(`/season/player?seasonStart=${singleSeason.start}&playerId=${playerId}`)
                      }
                    />
                  </>
                ) : seasonsInWindow.length === 0 ? (
                  <p className="text-center text-sm md:text-base text-primary-text/60 py-4">
                    No season games in the selected period
                  </p>
                ) : (
                  <p className="text-center text-sm md:text-base text-primary-text/60 py-4 px-4">
                    The selected period contains {seasonsInWindow.length} seasons, so a single season leaderboard cannot
                    be shown. Select a period within one season.
                  </p>
                ))}

              {/* Hall of Fame score changes between the two times */}
              {leaderboardTab === "hall-of-fame" && (
                <>
                  <p className="text-center text-sm md:text-base text-primary-text/60 py-1 md:py-2">
                    The hypothetical Hall of Fame leaderboard for all players
                  </p>
                  <DiffTable
                    startEntries={startHallOfFame}
                    endEntries={endHallOfFame}
                    sortBy={sortBy}
                    emptyText="No players at either time"
                    onRowClick={(playerId) => navigate(`/hall-of-fame/${playerId}`)}
                  />
                </>
              )}
            </>
          )}

          {/* Achievements earned between the two times */}
          {activeTab === "achievements" && (
            <div>
              <p className="text-center text-sm md:text-base text-primary-text/60 py-1 md:py-2">
                {achievementsInWindow.length} {achievementsInWindow.length === 1 ? "achievement" : "achievements"}{" "}
                between the two times
              </p>

              {achievementsInWindow.length > 0 && (
                <div className="flex flex-col text-primary-text text-xs xs:text-sm md:text-base border-t border-primary-text/50">
                  {achievementsInWindow.slice(0, visibleAchievements).map((achievement, index) => {
                    const label = getAchievementLabel(achievement.type, context.client.gameLimitForRanked);
                    return (
                      <div
                        key={`${achievement.type}-${achievement.earnedBy}-${achievement.earnedAt}-${index}`}
                        onClick={() => navigate(`/player/${achievement.earnedBy}`)}
                        className="flex items-center gap-2 md:gap-3 py-1 px-1 xs:px-2 md:px-3 border-b border-primary-text/50 bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors"
                      >
                        <span className="text-xl md:text-2xl shrink-0">{label.icon}</span>
                        <span className="font-medium truncate flex-1 min-w-0">{label.title}</span>
                        <div className="flex items-center justify-end gap-1 md:gap-2 min-w-0 max-w-[40%]">
                          <span className="truncate">{context.playerName(achievement.earnedBy)}</span>
                          <ProfilePicture playerId={achievement.earnedBy} size={24} border={2} />
                        </div>
                        <span className="whitespace-nowrap text-right">
                          <RelativeTime date={new Date(achievement.earnedAt)} variant="auto" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {achievementsInWindow.length > visibleAchievements && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={() => setVisibleAchievements((prev) => prev + ACHIEVEMENTS_PAGE_SIZE)}
                    className="px-6 py-2 rounded text-sm font-medium transition-colors ring-1 bg-secondary-background text-secondary-text ring-secondary-text hover:opacity-80"
                  >
                    Load {Math.min(ACHIEVEMENTS_PAGE_SIZE, achievementsInWindow.length - visibleAchievements)} more
                    achievements
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Games played between the two times */}
          {activeTab === "games" && (
            <div>
              <p className="text-center text-sm md:text-base text-primary-text/60 py-1 md:py-2">
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
                          onClick={() => navigate(`/game?time=${game.playedAt}`)}
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
                                  <PointSequenceMarker score={game.score} />
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
          )}
        </div>
      </div>
    </div>
  );
};
