import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
import { FACTORS } from "./hall-of-fame-factors";

type GraphMode = "cumulative" | "delta";
const GRAPH_MODE_STORAGE_KEY = "hall-of-fame-score-over-time-mode";

/** "Total" plus the 9 sections. Filters both the line and the bars. */
type SeriesKey = "total" | HallOfFameFactorKey;

const NEGATIVE_COLOR = "#ef4444";

export const HallOfFameScoreOverTime: React.FC<{ playerId: string; playerName: string }> = ({
  playerId,
  playerName,
}) => {
  const { startComputation, result, progress, failed } = useHallOfFameHistoryWorker();
  const [storedMode, setStoredMode] = useLocalStorage(GRAPH_MODE_STORAGE_KEY, "cumulative");
  const mode: GraphMode = storedMode === "delta" ? "delta" : "cumulative";
  const [series, setSeries] = useState<SeriesKey>("total");

  useEffect(() => {
    startComputation(playerId);
  }, [startComputation, playerId]);

  const points = result?.points;

  const graphData = useMemo(() => {
    if (!points) return [];
    let previous = 0;
    return points.map((point) => {
      const value = series === "total" ? point.total : point.factors[series];
      const delta = value - previous;
      previous = value;
      return { time: point.time, cumulative: value, delta };
    });
  }, [points, series]);

  const spansMoreThanAYear = useMemo(() => {
    if (graphData.length < 2) return false;
    return graphData[graphData.length - 1].time - graphData[0].time > ONE_YEAR;
  }, [graphData]);

  const formatTick = (time: number) =>
    new Date(time).toLocaleDateString(
      "nb-NO",
      spansMoreThanAYear ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" },
    );

  const seriesLabel = series === "total" ? "Total score" : FACTORS.find((f) => f.key === series)?.name ?? "";

  const summary = useMemo(() => {
    if (graphData.length === 0) return undefined;
    const current = graphData[graphData.length - 1].cumulative;
    const best = graphData.reduce((top, point) => (point.delta > top.delta ? point : top), graphData[0]);
    return { current, best };
  }, [graphData]);

  if (failed) {
    return (
      <p className="text-primary-text text-sm">
        The score over time needs a web worker, and this browser does not support one.
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

      <div className="flex flex-col xs:flex-row xs:items-end gap-3 xs:justify-between">
        <PillSelect<GraphMode>
          label="Graph"
          options={[
            { value: "cumulative", label: "Cumulative" },
            { value: "delta", label: "Delta" },
          ]}
          value={mode}
          onChange={setStoredMode}
        />
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
          {mode === "cumulative" ? (
            <LineChart data={graphData} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="1 4"
                vertical={false}
                stroke="rgb(var(--color-primary-text))"
                opacity={0.1}
              />
              <XAxis
                dataKey="time"
                tickFormatter={formatTick}
                interval={Math.max(0, Math.floor(graphData.length / 5))}
                stroke="rgb(var(--color-primary-text))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={6}
                opacity={0.6}
              />
              <YAxis
                type="number"
                domain={["auto", "auto"]}
                tickFormatter={(value: number) => fmtNum(value) ?? ""}
                stroke="rgb(var(--color-primary-text))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                opacity={0.6}
              />
              <Tooltip content={<ScoreTooltip mode={mode} seriesLabel={seriesLabel} />} />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="rgb(var(--color-primary-text))"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
                animationDuration={400}
              />
            </LineChart>
          ) : (
            <BarChart data={graphData} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="1 4"
                vertical={false}
                stroke="rgb(var(--color-primary-text))"
                opacity={0.1}
              />
              <XAxis
                dataKey="time"
                tickFormatter={formatTick}
                interval={Math.max(0, Math.floor(graphData.length / 5))}
                stroke="rgb(var(--color-primary-text))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={6}
                opacity={0.6}
              />
              <YAxis
                type="number"
                domain={["auto", "auto"]}
                tickFormatter={(value: number) => fmtNum(value) ?? ""}
                stroke="rgb(var(--color-primary-text))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                opacity={0.6}
              />
              <Tooltip
                cursor={{ fill: "rgb(var(--color-primary-text))", opacity: 0.08 }}
                content={<ScoreTooltip mode={mode} seriesLabel={seriesLabel} />}
              />
              <ReferenceLine y={0} stroke="rgb(var(--color-primary-text))" opacity={0.3} />
              <Bar dataKey="delta" animationDuration={400}>
                {graphData.map((point) => (
                  <Cell
                    key={point.time}
                    fill={point.delta < 0 ? NEGATIVE_COLOR : "rgb(var(--color-primary-text))"}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {summary && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-secondary-background text-secondary-text px-2 py-1 rounded">
            {seriesLabel} now: <span className="font-bold">{fmtNum(summary.current)} pts</span>
          </span>
          <span className="bg-secondary-background text-secondary-text px-2 py-1 rounded">
            Best period: <span className="font-bold">{fmtNum(summary.best.delta, { signedPositive: true })} pts</span>{" "}
            {dateString(summary.best.time)}
          </span>
          <span className={classNames("bg-secondary-background/50 text-secondary-text/75 px-2 py-1 rounded")}>
            {graphData.length} points, {mode === "delta" ? "gain per period" : "score at each point"}
          </span>
        </div>
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
  const data = payload[0].payload as { time: number; cumulative: number; delta: number };

  return (
    <div className="p-3 bg-primary-background/95 backdrop-blur-sm ring-1 ring-primary-text/20 rounded-lg text-primary-text shadow-lg">
      <div className="text-xs opacity-60 mb-1">{dateString(data.time)}</div>
      <div className="font-bold text-lg">
        {mode === "delta"
          ? `${fmtNum(data.delta, { signedPositive: true })} pts`
          : `${fmtNum(data.cumulative)} pts`}
      </div>
      <div className="text-xs opacity-75">{seriesLabel}</div>
      <div className="text-xs opacity-60 mt-1">
        {mode === "delta"
          ? `${fmtNum(data.cumulative)} pts in total`
          : `${fmtNum(data.delta, { signedPositive: true })} pts this period`}
      </div>
    </div>
  );
};
