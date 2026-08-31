import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { HallOfFameFactorKey } from "../../client/client-db/hall-of-fame";
import { HISTORY_MAX_POINTS } from "../../client/client-db/hall-of-fame-history";
import { classNames } from "../../common/class-names";
import { dateString } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";
import { PillSelect } from "../../common/pill-select";
import { ONE_YEAR } from "../../common/time-in-ms";
import { useHallOfFameHistoryWorker } from "../../hooks/use-hall-of-fame-history-worker";
import { useLocalStorage } from "../../hooks/use-local-storage";
import { deltaPoints } from "./hall-of-fame-delta-points";
import { FACTORS } from "./hall-of-fame-factors";
import { stackedShares } from "./hall-of-fame-stacked-shares";

type GraphMode = "cumulative" | "delta";
const GRAPH_MODE_STORAGE_KEY = "hall-of-fame-score-over-time-mode";

/** "Absolute" stacks the score in points. "Relative" stacks the share of each
 * section, so every point in time fills the full height. */
type StackScale = "absolute" | "relative";
const STACK_SCALE_STORAGE_KEY = "hall-of-fame-score-over-time-scale";

/** "Total" plus the 9 sections. Filters both graphs. */
type SeriesKey = "total" | HallOfFameFactorKey;

/** The zoom presets, as the percentage of the points that the graph shows.
 * The same presets as the score graph on the player page. */
const ZOOM_PRESETS = [
  { label: "All", value: 100 },
  { label: "50%", value: 50 },
  { label: "25%", value: 25 },
  { label: "10%", value: 10 },
];

/** Fewest visible points when zoomed in. */
const MIN_VISIBLE_POINTS = 10;

export const HallOfFameScoreOverTime: React.FC<{ playerId: string; playerName: string }> = ({
  playerId,
  playerName,
}) => {
  const { startComputation, result, progress, failed } = useHallOfFameHistoryWorker();
  const [storedMode, setStoredMode] = useLocalStorage(GRAPH_MODE_STORAGE_KEY, "cumulative");
  const mode: GraphMode = storedMode === "delta" ? "delta" : "cumulative";
  const [storedScale, setStoredScale] = useLocalStorage(STACK_SCALE_STORAGE_KEY, "absolute");
  const scale: StackScale = storedScale === "relative" ? "relative" : "absolute";
  const [series, setSeries] = useState<SeriesKey>("total");
  /** Percentage of the points the graph shows. */
  const [zoomLevel, setZoomLevel] = useState(100);
  /** Position from 0 to 100, where 100 is the end (most recent). */
  const [panPosition, setPanPosition] = useState(100);

  useEffect(() => {
    startComputation(playerId);
  }, [startComputation, playerId]);

  const points = result?.points;

  const graphData = useMemo(() => {
    if (!points) return [];
    return points.map((point, i) => {
      const previous = i === 0 ? point : points[i - 1];
      const value = series === "total" ? point.total : point.factors[series];
      const previousValue = series === "total" ? previous.total : previous.factors[series];
      return {
        time: point.time,
        from: i === 0 ? undefined : previous.time,
        cumulative: value,
        delta: value - previousValue,
      };
    });
  }, [points, series]);

  const stackedData = useMemo(() => {
    if (!points) return [];
    return points.map((point) => ({ time: point.time, total: point.total, ...point.factors }));
  }, [points]);

  const shareData = useMemo(() => (points ? stackedShares(points) : []), [points]);

  const deltaData = useMemo(() => (points ? deltaPoints(points) : []), [points]);

  /** The sections are only stacked on the total. The relative scale only
   * applies to the cumulative graph, where the stack has a stable height. */
  const stacked = series === "total";
  const relative = stacked && mode === "cumulative" && scale === "relative";

  const chartData =
    mode === "delta" ? (stacked ? deltaData : graphData) : stacked ? (relative ? shareData : stackedData) : graphData;

  // The visible window, from the zoom and pan controls. Every dataset has one
  // entry per simulated point, so the window applies to all of them.
  const totalPoints = chartData.length;
  const visibleCount = Math.max(MIN_VISIBLE_POINTS, Math.ceil((totalPoints * zoomLevel) / 100));
  const maxStartIndex = Math.max(0, totalPoints - visibleCount);
  const startIndex = Math.floor((panPosition / 100) * maxStartIndex);
  const visibleData = chartData.slice(startIndex, startIndex + visibleCount);

  const spansMoreThanAYear =
    visibleData.length >= 2 && visibleData[visibleData.length - 1].time - visibleData[0].time > ONE_YEAR;

  const formatTick = (time: number) =>
    new Date(time).toLocaleDateString(
      "nb-NO",
      spansMoreThanAYear ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" },
    );

  const sectionFactor = series === "total" ? undefined : FACTORS.find((f) => f.key === series);
  const seriesLabel = sectionFactor?.name ?? "Total score";

  const summary = useMemo(() => {
    if (graphData.length === 0) return undefined;
    const current = graphData[graphData.length - 1].cumulative;
    const best = graphData.reduce((top, point) => (point.delta > top.delta ? point : top), graphData[0]);
    return { current, best };
  }, [graphData]);

  if (failed) {
    return (
      <p className="text-primary-text text-sm">
        The score over time did not finish. The graph needs a web worker. Reload the page to try again.
      </p>
    );
  }

  if (!result) {
    return (
      <div className="space-y-2">
        <p className="text-primary-text text-sm">
          Simulating the score of {playerName} at up to {HISTORY_MAX_POINTS} points in time.
        </p>
        <div className="w-full h-2 bg-secondary-background rounded-full overflow-hidden">
          <div
            className="h-full bg-tertiary-background transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="text-primary-text/60 text-xs">{Math.round(progress * 100)}% done</p>
      </div>
    );
  }

  if (graphData.length < 2) {
    return (
      <p className="text-primary-text text-sm">
        {playerName} is too new for a graph. The score needs more than one day of history.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-primary-text text-sm">
        The score of {playerName} as it was at each point in time, from the day the player joined until now.
      </p>

      <div className="flex flex-col xs:flex-row xs:flex-wrap xs:items-end gap-3 xs:justify-between">
        <PillSelect<GraphMode>
          label="Graph"
          options={[
            { value: "cumulative", label: "Cumulative" },
            { value: "delta", label: "Delta" },
          ]}
          value={mode}
          onChange={setStoredMode}
        />
        {stacked && mode === "cumulative" && (
          <PillSelect<StackScale>
            label="Scale"
            options={[
              { value: "absolute", label: "Absolute" },
              { value: "relative", label: "Relative" },
            ]}
            value={scale}
            onChange={setStoredScale}
          />
        )}
        <div className="flex flex-col gap-1">
          <span className="text-xs md:text-sm text-primary-text/60">Section</span>
          <select
            value={series}
            onChange={(e) => setSeries(e.target.value as SeriesKey)}
            aria-label="Score section"
            className="bg-secondary-background text-secondary-text text-sm rounded-lg px-3 h-10 outline-none cursor-pointer"
          >
            <option value="total">Total score</option>
            {FACTORS.map((factor) => (
              <option key={factor.key} value={factor.key}>
                {factor.emoji} {factor.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="w-full h-[300px] md:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={visibleData}
            stackOffset={mode === "delta" ? "sign" : "none"}
            margin={{ top: 5, right: 8, left: -12, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="1 4"
              vertical={false}
              stroke="rgb(var(--color-primary-text))"
              opacity={0.1}
            />
            <XAxis
              dataKey="time"
              tickFormatter={formatTick}
              interval={Math.max(0, Math.floor(visibleData.length / 5))}
              stroke="rgb(var(--color-primary-text))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={6}
              opacity={0.6}
            />
            <YAxis
              type="number"
              domain={relative ? [0, 100] : ["auto", "auto"]}
              tickFormatter={
                relative ? (value: number) => `${fmtNum(value) ?? ""}%` : (value: number) => fmtNum(value) ?? ""
              }
              stroke="rgb(var(--color-primary-text))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              opacity={0.6}
            />
            <Tooltip
              content={
                stacked ? (
                  <StackedTooltip relative={relative} delta={mode === "delta"} />
                ) : (
                  <ScoreTooltip mode={mode} seriesLabel={seriesLabel} />
                )
              }
            />
            {mode === "delta" && <ReferenceLine y={0} stroke="rgb(var(--color-primary-text))" opacity={0.3} />}
            {stacked ? (
              // Rendered in reverse, so the first section lands on top of the
              // stack. The graph then reads in the order of the legend.
              [...FACTORS]
                .reverse()
                .map((factor) => (
                  <Area
                    key={factor.key}
                    type="monotone"
                    dataKey={factor.key}
                    stackId="score"
                    name={factor.name}
                    fill={factor.color}
                    fillOpacity={1}
                    stroke="#ffffff"
                    strokeWidth={0.5}
                    animationDuration={400}
                  />
                ))
            ) : (
              <Area
                type="monotone"
                dataKey={mode === "delta" ? "delta" : "cumulative"}
                fill={sectionFactor?.color}
                fillOpacity={1}
                stroke={sectionFactor?.color}
                strokeWidth={2}
                activeDot={{ r: 5, strokeWidth: 0 }}
                animationDuration={400}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {totalPoints > 50 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary-text whitespace-nowrap">Zoom:</span>
            <div className="flex gap-1">
              {ZOOM_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => {
                    setZoomLevel(preset.value);
                    // Reset pan to end when zooming
                    setPanPosition(100);
                  }}
                  className={classNames(
                    "px-3 py-1 rounded text-sm font-medium transition-colors",
                    zoomLevel === preset.value
                      ? "bg-secondary-background text-secondary-text"
                      : "bg-primary-background text-primary-text border border-primary-text/20 hover:bg-secondary-background/50",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {zoomLevel < 100 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary-text whitespace-nowrap">Pan:</span>
              <input
                className="w-full"
                type="range"
                min={0}
                max={100}
                value={panPosition}
                onChange={(e) => setPanPosition(Number(e.target.value))}
              />
            </div>
          )}
        </div>
      )}

      {stacked && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {FACTORS.map((factor) => (
            <span key={factor.key} className="flex items-center gap-1.5 text-xs text-primary-text">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: factor.color }} />
              {factor.emoji} {factor.name}
            </span>
          ))}
        </div>
      )}

      {summary && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-secondary-background text-secondary-text px-2 py-1 rounded">
            {seriesLabel} now: <span className="font-bold">{fmtNum(summary.current)} pts</span>
          </span>
          <span className="bg-secondary-background text-secondary-text px-2 py-1 rounded">
            Best period: <span className="font-bold">{fmtNum(summary.best.delta, { signedPositive: true })} pts</span>{" "}
            {dateString(summary.best.time)}
          </span>
          <span className="bg-secondary-background/50 text-secondary-text/75 px-2 py-1 rounded">
            {mode === "delta"
              ? `${graphData.length - 1} periods, gain in each`
              : relative
                ? `${graphData.length} points, share of the score at each`
                : `${graphData.length} points, score at each`}
          </span>
        </div>
      )}
    </div>
  );
};

// Day and month only, for the start of a period whose end already names the year.
const shortDate = (time: number) => new Date(time).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });

const StackedTooltip = ({
  active,
  payload,
  relative,
  delta,
}: TooltipProps<ValueType, NameType> & { relative: boolean; delta: boolean }) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload as {
    time: number;
    from?: number;
    total: number;
    cumulative?: number;
    absolute?: Record<HallOfFameFactorKey, number>;
  } & Record<HallOfFameFactorKey, number>;

  return (
    <div className="p-3 bg-primary-background/95 backdrop-blur-sm ring-1 ring-primary-text/20 rounded-lg text-primary-text shadow-lg">
      <div className="text-xs opacity-60 mb-1">
        {delta && data.from !== undefined
          ? `${shortDate(data.from)} – ${dateString(data.time)}`
          : dateString(data.time)}
      </div>
      <div className="font-bold text-lg">
        {delta ? `${fmtNum(data.total, { signedPositive: true })} pts` : `${fmtNum(data.total)} pts`}
      </div>
      <div className="mt-1 space-y-0.5">
        {FACTORS.map((factor) => (
          <div key={factor.key} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: factor.color }} />
            <span className="opacity-75">{factor.name}</span>
            <span className="ml-auto pl-4 font-bold">
              {relative
                ? `${fmtNum(data[factor.key], { digits: 1 })}%`
                : fmtNum(data[factor.key], delta ? { signedPositive: true } : undefined)}
            </span>
            {relative && data.absolute && (
              <span className="opacity-60 w-10 text-right">{fmtNum(data.absolute[factor.key])}</span>
            )}
          </div>
        ))}
      </div>
      {delta && data.cumulative !== undefined && (
        <div className="text-xs opacity-60 mt-1">{fmtNum(data.cumulative)} pts in total after the period</div>
      )}
    </div>
  );
};

const ScoreTooltip = ({
  active,
  payload,
  mode,
  seriesLabel,
}: TooltipProps<ValueType, NameType> & { mode: GraphMode; seriesLabel: string }) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload as { time: number; from?: number; cumulative: number; delta: number };

  return (
    <div className="p-3 bg-primary-background/95 backdrop-blur-sm ring-1 ring-primary-text/20 rounded-lg text-primary-text shadow-lg">
      <div className="text-xs opacity-60 mb-1">
        {mode === "delta" && data.from !== undefined
          ? `${shortDate(data.from)} – ${dateString(data.time)}`
          : dateString(data.time)}
      </div>
      <div className="font-bold text-lg">
        {mode === "delta" ? `${fmtNum(data.delta, { signedPositive: true })} pts` : `${fmtNum(data.cumulative)} pts`}
      </div>
      <div className="text-xs opacity-75">{seriesLabel}</div>
      <div className="text-xs opacity-60 mt-1">
        {mode === "delta"
          ? `${fmtNum(data.cumulative)} pts in total after the period`
          : `${fmtNum(data.delta, { signedPositive: true })} pts since the previous point`}
      </div>
    </div>
  );
};
