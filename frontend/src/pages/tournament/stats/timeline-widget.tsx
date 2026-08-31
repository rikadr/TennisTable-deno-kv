import { useMemo } from "react";
import { Tournament } from "../../../client/client-db/tournaments/tournament";
import {
  buildTournamentTimeline,
  TimelineRef,
  TimelineSection,
} from "../../../client/client-db/tournaments/tournament-timeline";
import { classNames } from "../../../common/class-names";
import { fmtNum } from "../../../common/number-utils";
import { ONE_DAY } from "../../../common/time-in-ms";
import { bracketLayerIndexToTournamentRound, secondChanceRoundLabel } from "../../leaderboard/tournament-pending-games";

type Row = {
  key: string;
  label: string;
  depth: 0 | 1;
  start: number;
  /** The row's clock is running: its first game is (or was) available to play */
  started: boolean;
  /** Undefined while the row still has games left to play */
  end?: number;
};

/**
 * The three columns of every row: what it is, how long it took, and the bar showing when. Fixed
 * widths with a minimum for the bars, so the chart scrolls sideways on a narrow screen instead of
 * squeezing the bars and the axis labels into each other
 */
const LABEL_COLUMN = "w-52";
const DURATION_COLUMN = "w-24";
const CHART_MIN_WIDTH = "min-w-[35rem]";

const DAY_STEPS = [1, 2, 3, 5, 7, 14, 30, 60, 90, 180, 365];

/** Axis ticks measured in whole days from the tournament start */
function buildTicks(totalDays: number): { at: number; label: string }[] {
  const ticks: { at: number; label: string }[] = [];
  const step = DAY_STEPS.find((candidate) => totalDays / candidate <= 6) ?? Math.ceil(totalDays / 6);
  for (let day = 0; day <= totalDays; day += step) {
    // A tick right at the end would be cut off by the edge of the chart
    if (day / totalDays > 0.96) break;
    ticks.push({ at: day, label: `${fmtNum(day)}d` });
  }
  return ticks;
}

/** Local midnight of the calendar day holding `time` */
function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Whole calendar days from the day of `from` to the day of `time`, so a same day pair is 0 and the
 * next day is 1. Math.round absorbs the 23 and 25 hour days daylight saving hands out
 */
function dayIndex(time: number, from: number): number {
  return Math.round((startOfDay(time) - startOfDay(from)) / ONE_DAY);
}

export const TournamentTimelineWidget: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  const timeline = useMemo(() => buildTournamentTimeline(tournament), [tournament]);
  // A tournament that is still running is drawn up against now, so the last bar keeps growing
  const now = Date.now();

  if (!timeline) {
    return (
      <WidgetFrame>
        <Header />
        <p className="text-sm font-light">The tournament has not started yet, so there is nothing on the timeline.</p>
      </WidgetFrame>
    );
  }

  const doubleElimination = tournament.tournamentConfig.doubleElimination;
  const rows: Row[] = [];
  for (const section of timeline.sections) {
    rows.push({
      key: section.key,
      label: sectionLabel(section, doubleElimination),
      depth: 0,
      start: section.start,
      started: section.started,
      end: section.completed ? section.lastGameAt : undefined,
    });
    // A single sub section would just repeat its section
    if (section.subSections.length <= 1) continue;
    for (const sub of section.subSections) {
      rows.push({
        key: `${section.key}-${sub.key}`,
        label: refLabel(sub.ref, doubleElimination),
        depth: 1,
        start: sub.start,
        started: sub.started,
        end: sub.completed ? sub.lastGameAt : undefined,
      });
    }
  }

  const start = timeline.start;
  const end = timeline.completed ? (timeline.lastGameAt ?? start) : now;
  // Days are counted inclusively, so a tournament played out in one afternoon is a single day wide
  const totalDays = dayIndex(end, start) + 1;

  const ticks = buildTicks(totalDays);

  return (
    <WidgetFrame>
      <Header>
        {timeline.completed ? "Ran for" : "Running for"} <span className="font-bold">{formatDays(totalDays)}</span>
        {" · "}
        {fmtNum(timeline.gamesPlayed)} of {fmtNum(timeline.gamesTotal)} games played
      </Header>

      <div className="overflow-x-auto pb-1">
        <div className={classNames("space-y-1", CHART_MIN_WIDTH)}>
          {/* Axis, days from the tournament start */}
          <div className="flex items-end gap-2">
            <div className={classNames(LABEL_COLUMN, "shrink-0")} />
            <div className={classNames(DURATION_COLUMN, "shrink-0")} />
            <div className="relative grow h-4">
              {ticks.map((tick) => (
                <div
                  key={tick.at}
                  className="absolute bottom-0 text-[0.65rem] leading-none font-light -translate-x-1/2"
                  style={{ left: `${(tick.at / totalDays) * 100}%` }}
                >
                  {tick.label}
                </div>
              ))}
            </div>
          </div>

          {rows.map((row) => (
            <TimelineRow
              key={row.key}
              row={row}
              timelineStart={start}
              totalDays={totalDays}
              now={now}
              gridLines={ticks.map((tick) => tick.at)}
            />
          ))}
        </div>
      </div>
    </WidgetFrame>
  );
};

const WidgetFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="ring-1 ring-secondary-background w-full max-w-4xl mx-auto px-4 md:px-6 py-6 text-primary-text bg-primary-background rounded-lg shadow-sm">
    {children}
  </div>
);

const Header: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-6">
    <h2 className="text-xl font-bold">Timeline</h2>
    {children && <p className="text-sm">{children}</p>}
  </div>
);

const TimelineRow: React.FC<{
  row: Row;
  timelineStart: number;
  totalDays: number;
  now: number;
  /** Day indexes, measured from the tournament start */
  gridLines: number[];
}> = ({ row, timelineStart, totalDays, now, gridLines }) => {
  const isSection = row.depth === 0;
  const ongoing = row.end === undefined;
  // A row is on the clock from the moment its first game is available, played or not: the time
  // spent waiting for the players is part of how long it takes. A row none of whose games have
  // been reachable yet has no clock to show
  const notStarted = ongoing && !row.started;
  const barEnd = row.end ?? now;

  // The bar covers whole days, from the first day of the row through its last one
  const firstDay = dayIndex(row.start, timelineStart);
  const days = Math.max(1, dayIndex(barEnd, timelineStart) - firstDay + 1);

  const leftPercent = (firstDay / totalDays) * 100;
  const widthPercent = (days / totalDays) * 100;

  return (
    <div
      className={classNames("flex items-center gap-2", isSection && "pt-2")}
      title={
        notStarted
          ? "Waiting for an earlier round to finish"
          : `${formatDate(row.start)} → ${ongoing ? "ongoing" : formatDate(barEnd)}`
      }
    >
      <div className={classNames(LABEL_COLUMN, "shrink-0", isSection ? "" : "pl-3")}>
        <p className={classNames("truncate", isSection ? "text-sm font-semibold" : "text-xs font-normal")}>
          {row.label}
        </p>
      </div>

      {/* Kept left of the bar so the durations stay readable when the chart scrolls sideways */}
      <div className={classNames(DURATION_COLUMN, "shrink-0 text-right")}>
        <p
          className={classNames(
            isSection ? "text-sm font-medium" : "text-xs",
            notStarted && "font-light italic",
            ongoing && !notStarted && "italic",
          )}
        >
          {notStarted ? "not started" : formatDays(days)}
        </p>
      </div>

      {/* Everything here is the secondary background on the widget's primary one - the contrast
          every card in the app already relies on, so it holds up in every theme. The lane is only a
          hairline and the axis grid thin ticks, leaving the played span as the one solid block */}
      <div className={classNames("relative grow", isSection ? "h-5" : "h-3")}>
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-secondary-background" />
        {gridLines.map((at) => (
          <div
            key={at}
            className="absolute inset-y-0 w-px bg-secondary-background"
            style={{ left: `${(at / totalDays) * 100}%` }}
          />
        ))}
        {/* A round that is not yet reachable has no span to draw: the bare lane says it all */}
        {notStarted === false && (
          <div
            className="absolute inset-y-0 rounded bg-secondary-background"
            style={{ left: `${leftPercent}%`, width: `max(${widthPercent}%, 3px)` }}
          />
        )}
      </div>
    </div>
  );
};

function sectionLabel(section: TimelineSection, doubleElimination: boolean): string {
  switch (section.kind) {
    case "group-play":
      return "Group play";
    case "winners":
      return doubleElimination ? "First chance bracket" : "Bracket";
    case "losers":
      return "Second chance bracket";
    case "grand-final":
      return "Final";
  }
}

function refLabel(ref: TimelineRef, doubleElimination: boolean): string {
  switch (ref.kind) {
    case "group":
      return `Group ${ref.groupIndex + 1}`;
    case "winners-layer":
      return bracketLayerIndexToTournamentRound(ref.layerIndex, doubleElimination) ?? `Layer ${ref.layerIndex}`;
    case "losers-layer":
      return secondChanceRoundLabel(ref.layerIndex, ref.totalLayers).title;
    case "grand-final-game":
      return "Final";
    case "bracket-reset":
      return "The Final Decider";
  }
}

/** Whole calendar days, counting both the first and the last day */
function formatDays(days: number): string {
  return `${fmtNum(days)} ${days === 1 ? "day" : "days"}`;
}

function formatDate(time: number): string {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(new Date(time));
}
