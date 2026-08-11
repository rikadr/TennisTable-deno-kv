import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { TennisTable } from "../../client/client-db/tennis-table";
import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { WorkerMessage } from "../../client/client-db/web-worker/web-worker";
import { createModernWorker } from "../../hooks/use-elo-simulation-worker";
import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { RelativeTime } from "../../common/date-utils";
import { Game } from "../../client/client-db/event-store/projectors/games-projector";
import { Achievement } from "../../client/client-db/achievements";
import { getAchievementLabel } from "../player/player-achievements";
import { ProfilePicture } from "../player/profile-picture";

type SortBy = "start" | "end" | "delta";
type Source = "actual" | "expected";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const GAMES_PAGE_SIZE = 50;
const ACHIEVEMENTS_PAGE_SIZE = 50;

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

// The full app state projected at a point in time.
function useStateAt(time: number | undefined): TennisTable | undefined {
  const context = useEventDbContext();
  return useMemo(() => {
    if (time === undefined) return undefined;
    return new TennisTable({ events: eventsUpTo(context.events, time), referenceTime: time });
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
      <div className="relative flex h-10 w-40 rounded-full bg-secondary-background p-1">
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
              "z-10 flex-1 flex items-center justify-center text-xs xs:text-sm whitespace-nowrap rounded-full focus:outline-none",
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
      // Biggest climbers first; rows without a delta go to the bottom.
      const rankDelta = (row: DiffRow) =>
        row.startRank !== undefined && row.endRank !== undefined ? row.startRank - row.endRank : -Infinity;
      const scoreDelta = (row: DiffRow) =>
        row.startScore !== undefined && row.endScore !== undefined ? row.endScore - row.startScore : -Infinity;
      return list.sort(
        (a, b) =>
          rankDelta(b) - rankDelta(a) ||
          scoreDelta(b) - scoreDelta(a) ||
          (a.endRank ?? Infinity) - (b.endRank ?? Infinity),
      );
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

  const [initialNow] = useState(() => Date.now());
  const [fromValue, setFromValue] = useState(() => toDatetimeLocalValue(initialNow - WEEK_MS));
  const [toValue, setToValue] = useState(() => toDatetimeLocalValue(initialNow));
  const [sortBy, setSortBy] = useState<SortBy>("end");
  const [source, setSource] = useState<Source>("actual");

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
  const startExpected = useExpectedLeaderboardAt(startTime, source === "expected");
  const endExpected = useExpectedLeaderboardAt(endTime, source === "expected");

  const simulating = source === "expected" && (startExpected.loading || endExpected.loading);
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
          <h1 className="text-2xl md:text-4xl text-center mt-2 md:mt-4 text-primary-text">What changed</h1>
          <p className="text-center text-sm md:text-base text-primary-text/60 mb-1 md:mb-2">
            Changes between two points in time
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
            <PillSelect<SortBy>
              label="Sort by"
              options={[
                { value: "start", label: "# Start" },
                { value: "end", label: "# End" },
                { value: "delta", label: "Δ" },
              ]}
              value={sortBy}
              onChange={setSortBy}
            />
            <PillSelect<Source>
              label="Leaderboard"
              options={[
                { value: "actual", label: "Actual" },
                { value: "expected", label: "Expected" },
              ]}
              value={source}
              onChange={setSource}
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
          ) : (
            <DiffTable
              startEntries={source === "actual" ? startActual : startExpected.entries}
              endEntries={source === "actual" ? endActual : endExpected.entries}
              sortBy={sortBy}
              emptyText="No ranked players at either time"
              onRowClick={(playerId) => navigate(`/player/${playerId}`)}
            />
          )}

          {/* Season leaderboard changes between the two times */}
          <div className="mt-4 border-t border-primary-text/20">
            <h2 className="text-lg md:text-2xl text-center mt-2 text-primary-text">Season leaderboard</h2>
            {singleSeason ? (
              <>
                <p className="text-center text-sm md:text-base text-primary-text/60 mb-1 md:mb-2">{singleSeasonName}</p>
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
              <p className="text-center text-sm md:text-base text-primary-text/60 pb-4">
                No season games in the selected period
              </p>
            ) : (
              <p className="text-center text-sm md:text-base text-primary-text/60 pb-4 px-4">
                The selected period contains {seasonsInWindow.length} seasons, so a single season leaderboard cannot be
                shown. Select a period within one season.
              </p>
            )}
          </div>

          {/* Hall of Fame score changes between the two times */}
          <div className="mt-4 border-t border-primary-text/20">
            <h2 className="text-lg md:text-2xl text-center mt-2 text-primary-text">Hall of Fame score</h2>
            <p className="text-center text-sm md:text-base text-primary-text/60 mb-1 md:mb-2">
              The hypothetical Hall of Fame leaderboard for all players
            </p>
            <DiffTable
              startEntries={startHallOfFame}
              endEntries={endHallOfFame}
              sortBy={sortBy}
              emptyText="No players at either time"
              onRowClick={(playerId) => navigate(`/hall-of-fame/${playerId}`)}
            />
          </div>

          {/* Achievements earned between the two times */}
          <div className="mt-4 border-t border-primary-text/20">
            <h2 className="text-lg md:text-2xl text-center mt-2 text-primary-text">Achievements earned</h2>
            <p className="text-center text-sm md:text-base text-primary-text/60 mb-1 md:mb-2">
              {achievementsInWindow.length} {achievementsInWindow.length === 1 ? "achievement" : "achievements"} between
              the two times
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
