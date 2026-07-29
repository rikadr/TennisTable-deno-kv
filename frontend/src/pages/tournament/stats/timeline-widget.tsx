import { useMemo } from "react";
import { Tournament } from "../../../client/client-db/tournaments/tournament";
import {
  buildTournamentTimeline,
  TimelineRef,
  TimelineSection,
} from "../../../client/client-db/tournaments/tournament-timeline";
import { classNames } from "../../../common/class-names";
import { fmtNum } from "../../../common/number-utils";
import { ONE_DAY, ONE_HOUR, ONE_MINUTE } from "../../../common/time-in-ms";
import { layerIndexToTournamentRound, losersRoundLabel } from "../../leaderboard/tournament-pending-games";

type Row = {
  key: string;
  label: string;
  sublabel?: string;
  depth: 0 | 1;
  start: number;
  /** Undefined while the row still has games left to play */
  end?: number;
  gamesPlayed: number;
  gamesTotal: number;
};

/**
 * The three columns of every row: what it is, how long it took, and the bar showing when. Fixed
 * widths with a minimum for the bars, so the chart scrolls sideways on a narrow screen instead of
 * squeezing the bars and the axis labels into each other
 */
const LABEL_COLUMN = "w-52";
const DURATION_COLUMN = "w-24";
const CHART_MIN_WIDTH = "min-w-[35rem]";

const DAY_STEPS = [0.5, 1, 2, 3, 5, 7, 14, 30, 60, 90, 180, 365];
const HOUR_STEPS = [1, 2, 3, 6, 12];

/** Axis ticks measured from the tournament start, in days unless the whole thing fits in a day */
function buildTicks(total: number): { at: number; label: string }[] {
  const ticks: { at: number; label: string }[] = [];
  const unit = total < ONE_DAY ? ONE_HOUR : ONE_DAY;
  const suffix = unit === ONE_HOUR ? "h" : "d";
  const steps = unit === ONE_HOUR ? HOUR_STEPS : DAY_STEPS;
  const totalUnits = total / unit;
  const step = steps.find((candidate) => totalUnits / candidate <= 6) ?? Math.ceil(totalUnits / 6);
  for (let value = 0; value <= totalUnits + 1e-9; value += step) {
    // A tick right at the end would be cut off by the edge of the chart
    if (value / totalUnits > 0.96) break;
    ticks.push({ at: value * unit, label: `${fmtNum(value, { digits: step < 1 ? 1 : 0 })}${suffix}` });
  }
  return ticks;
}

export const TournamentTimelineWidget: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  const timeline = useMemo(() => buildTournamentTimeline(tournament), [tournament]);
  // A tournament that is still running is drawn up against now, so the last bar keeps growing
  const now = Date.now();

  if (!timeline) {
    return (
      <WidgetFrame>
        <p className="text-sm text-primary-text/70">
          The tournament has not started yet, so there is nothing on the timeline.
        </p>
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
      end: section.completed ? section.lastGameAt : undefined,
      gamesPlayed: section.gamesPlayed,
      gamesTotal: section.gamesTotal,
    });
    // A single sub section would just repeat its section
    if (section.subSections.length <= 1) continue;
    for (const sub of section.subSections) {
      const { label, sublabel } = refLabel(sub.ref);
      rows.push({
        key: `${section.key}-${sub.key}`,
        label,
        sublabel,
        depth: 1,
        start: sub.start,
        end: sub.completed ? sub.lastGameAt : undefined,
        gamesPlayed: sub.gamesPlayed,
        gamesTotal: sub.gamesTotal,
      });
    }
  }

  const start = timeline.start;
  const end = timeline.completed ? timeline.lastGameAt ?? start : now;
  const total = Math.max(end - start, ONE_MINUTE); // Never divide by zero on a same-minute tournament

  const ticks = buildTicks(total);

  return (
    <WidgetFrame>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-6">
        <h2 className="text-xl font-bold">Timeline</h2>
        <p className="text-sm text-primary-text/70">
          {timeline.completed ? "Ran for" : "Running for"} <span className="font-semibold">{formatSpan(total)}</span>
          {" · "}
          {fmtNum(timeline.gamesPlayed)} of {fmtNum(timeline.gamesTotal)} games played
        </p>
      </div>

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
                  className="absolute bottom-0 text-[0.6rem] leading-none text-primary-text/50 -translate-x-1/2"
                  style={{ left: `${(tick.at / total) * 100}%` }}
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
              total={total}
              now={now}
              gridLines={ticks.map((tick) => tick.at)}
            />
          ))}
        </div>
      </div>

      <p className="mt-6 text-xs text-primary-text/50 leading-relaxed">
        A round's clock starts when it became possible to play - when the round feeding it finished - and ends at its
        last game, so the waiting counts towards how long it took. The groups of the group play all start together at
        the tournament start.
      </p>
    </WidgetFrame>
  );
};

const WidgetFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="ring-1 ring-secondary-background w-full max-w-4xl mx-auto px-4 md:px-6 py-6 text-primary-text bg-primary-background rounded-lg shadow-sm">
    {children}
  </div>
);

const TimelineRow: React.FC<{
  row: Row;
  timelineStart: number;
  total: number;
  now: number;
  gridLines: number[];
}> = ({ row, timelineStart, total, now, gridLines }) => {
  const isSection = row.depth === 0;
  const ongoing = row.end === undefined;
  const notStarted = ongoing && row.gamesPlayed === 0;
  const barEnd = row.end ?? now;
  const span = Math.max(0, barEnd - row.start);

  const leftPercent = ((row.start - timelineStart) / total) * 100;
  const widthPercent = (span / total) * 100;

  return (
    <div
      className={classNames("flex items-center gap-2", isSection && "pt-2")}
      title={
        notStarted
          ? "No games played yet"
          : `${formatDateTime(row.start)} → ${ongoing ? "ongoing" : formatDateTime(barEnd)}`
      }
    >
      <div className={classNames(LABEL_COLUMN, "shrink-0", isSection ? "" : "pl-3")}>
        <p
          className={classNames(
            "truncate",
            isSection ? "text-sm font-semibold" : "text-xs text-primary-text/80",
            notStarted && "text-primary-text/40",
          )}
        >
          {row.label}
        </p>
        {row.sublabel && <p className="truncate text-[0.6rem] font-light text-primary-text/50">{row.sublabel}</p>}
      </div>

      {/* Kept left of the bar so the durations stay readable when the chart scrolls sideways */}
      <div className={classNames(DURATION_COLUMN, "shrink-0 text-right")}>
        <p className={classNames(isSection ? "text-sm font-medium" : "text-xs", notStarted && "text-primary-text/40")}>
          {notStarted ? "not started" : formatSpan(span)}
        </p>
        <p className="text-[0.6rem] font-light text-primary-text/50">
          {fmtNum(row.gamesPlayed)}/{fmtNum(row.gamesTotal)} games
        </p>
      </div>

      <div
        className={classNames(
          "relative grow overflow-hidden rounded bg-secondary-background/15",
          isSection ? "h-5" : "h-3.5",
        )}
      >
        {gridLines.map((at) => (
          <div
            key={at}
            className="absolute inset-y-0 w-px bg-primary-text/10"
            style={{ left: `${(at / total) * 100}%` }}
          />
        ))}
        {/* A round with no games played has no span to draw: the empty track says it all */}
        {notStarted === false && (
          <div
            className={classNames(
              "absolute inset-y-0 rounded",
              isSection ? "bg-secondary-background" : "bg-secondary-background/60",
              ongoing && "ring-1 ring-tertiary-background",
            )}
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
      return doubleElimination ? "Winners bracket" : "Bracket";
    case "losers":
      return "Losers bracket";
    case "grand-final":
      return "Grand Final";
  }
}

function refLabel(ref: TimelineRef): { label: string; sublabel?: string } {
  switch (ref.kind) {
    case "group":
      return { label: `Group ${ref.groupIndex + 1}` };
    case "winners-layer":
      return { label: layerIndexToTournamentRound(ref.layerIndex) ?? `Layer ${ref.layerIndex}` };
    case "losers-layer": {
      const { title, subtitle } = losersRoundLabel(ref.layerIndex, ref.totalLayers);
      return { label: title, sublabel: subtitle };
    }
    case "grand-final-game":
      return { label: "Grand Final" };
    case "bracket-reset":
      return { label: "Bracket Reset" };
  }
}

/** Durations are read in days, but sub-day spans would all collapse to "0 days" */
function formatSpan(ms: number): string {
  if (ms < ONE_MINUTE) return "< 1 min";
  if (ms < ONE_HOUR) return `${fmtNum(ms / ONE_MINUTE)} min`;
  if (ms < ONE_DAY) return `${fmtNum(ms / ONE_HOUR, { digits: 1 })} hours`;
  const days = ms / ONE_DAY;
  return `${fmtNum(days, { digits: days < 10 ? 1 : 0 })} days`;
}

function formatDateTime(time: number): string {
  return new Intl.DateTimeFormat("en-US", {
    minute: "numeric",
    hour: "numeric",
    hour12: false,
    day: "numeric",
    month: "short",
  }).format(new Date(time));
}
