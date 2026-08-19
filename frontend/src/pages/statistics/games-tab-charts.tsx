import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtNum } from "../../common/number-utils";
import { ACCENT_COLOR, AXIS_COLOR, LEVEL_COLORS, percentLabel, percentTick, seriesColor, SERIES_COLOR, TooltipCard } from "./percent-chart";
import { DetailLevelPoint, PointLevelStats, SetLevelStats } from "./statistics-aggregations";

const formatMonth = (key: string): string => {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

/** The bands of the detail chart, from the bottom of the stack up. */
const LEVEL_BANDS = [
  { key: "tracked", label: "Every point", color: LEVEL_COLORS.tracked },
  { key: "points", label: "Points of each set", color: LEVEL_COLORS.points },
  { key: "sets", label: "Sets", color: LEVEL_COLORS.sets },
  { key: "noScore", label: "Result only", color: LEVEL_COLORS.noScore },
] as const;

/** The four levels of detail per month. The bands stack to 100% of the month. */
export const DetailLevelChart: React.FC<{ data: DetailLevelPoint[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.3} />
      <XAxis
        dataKey="period"
        stroke={AXIS_COLOR}
        tick={{ fontSize: 11 }}
        tickFormatter={formatMonth}
        angle={-45}
        textAnchor="end"
        height={70}
      />
      <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={percentTick} />
      <Tooltip
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <TooltipCard title={formatMonth(String(label))}>
              {[...LEVEL_BANDS].reverse().map((band) => {
                const entry = payload.find((item) => item.dataKey === band.key);
                if (entry === undefined) return null;
                return (
                  <p key={band.key}>
                    {band.label}: {percentLabel(Number(entry.value))}
                  </p>
                );
              })}
            </TooltipCard>
          );
        }}
      />
      {LEVEL_BANDS.map((band) => (
        <Area
          key={band.key}
          type="monotone"
          dataKey={band.key}
          name={band.label}
          stackId="detail"
          stroke={band.color}
          fill={band.color}
          fillOpacity={1}
          isAnimationActive={false}
        />
      ))}
    </AreaChart>
  </ResponsiveContainer>
);

/** The legend of the detail chart, printed under it so the bands are named. */
export const DetailLevelLegend: React.FC = () => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs text-primary-text/80">
    {[...LEVEL_BANDS].reverse().map((band) => (
      <span key={band.key} className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: band.color }} />
        {band.label}
      </span>
    ))}
  </div>
);

/** The set score of a game, read from the winner. The slices add up to 100%. */
export const SetScorePie: React.FC<{ data: SetLevelStats["byScore"] }> = ({ data }) => (
  <div className="flex flex-col gap-2">
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} dataKey="share" nameKey="score" outerRadius="95%" stroke="none" isAnimationActive={false}>
          {data.map((slice, index) => (
            <Cell key={slice.score} fill={seriesColor(index)} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const slice = payload[0].payload as SetLevelStats["byScore"][number];
            return (
              <TooltipCard title={slice.score}>
                <p>{percentLabel(slice.share)} of the games with sets</p>
                <p>{slice.setsPlayed === 1 ? "1 set" : `${slice.setsPlayed} sets`}</p>
              </TooltipCard>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
    <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs text-primary-text/80">
      {data.map((slice, index) => (
        <span key={slice.score} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: seriesColor(index) }} />
          {slice.score}
          <span className="tabular-nums opacity-70">{percentLabel(slice.share)}</span>
        </span>
      ))}
    </div>
  </div>
);

/** How many sets a game holds, as a share of the games with sets. */
export const SetsPlayedChart: React.FC<{ data: SetLevelStats["bySetsPlayed"] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.3} />
      <XAxis
        dataKey="setsPlayed"
        stroke={AXIS_COLOR}
        tick={{ fontSize: 11 }}
        tickFormatter={(value: number) => (value === 1 ? "1 set" : `${value} sets`)}
      />
      <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} tickFormatter={percentTick} />
      <Tooltip
        cursor={false}
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <TooltipCard title={Number(label) === 1 ? "1 set" : `${label} sets`}>
              <p>{percentLabel(Number(payload[0].value))} of the games with sets</p>
            </TooltipCard>
          );
        }}
      />
      <Bar dataKey="share" fill={SERIES_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
    </BarChart>
  </ResponsiveContainer>
);

/** The score the losing side of a set ends on, over every set with points. */
export const LosingScoreChart: React.FC<{ data: PointLevelStats["losingSetScores"] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={220}>
    <BarChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.3} />
      <XAxis dataKey="label" stroke={AXIS_COLOR} tick={{ fontSize: 11 }} />
      <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} tickFormatter={percentTick} />
      <Tooltip
        cursor={false}
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          const title = label === "deuce" ? "The set reached deuce" : `The loser of the set got ${label}`;
          return (
            <TooltipCard title={title}>
              <p>{percentLabel(Number(payload[0].value))} of the sets</p>
            </TooltipCard>
          );
        }}
      />
      <Bar dataKey="share" radius={[4, 4, 0, 0]} isAnimationActive={false}>
        {data.map((entry) => (
          <Cell key={entry.label} fill={entry.label === "deuce" ? ACCENT_COLOR : SERIES_COLOR} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

/** The points a game holds, one step per total, with the median marked. */
export const PointsPerGameChart: React.FC<{ data: PointLevelStats["pointsPerGame"]; median: number }> = ({
  data,
  median,
}) => (
  <ResponsiveContainer width="100%" height={240}>
    <LineChart data={data} margin={{ top: 24, right: 10, bottom: 20, left: -10 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.3} />
      <XAxis
        dataKey="points"
        type="number"
        domain={["dataMin", "dataMax"]}
        tickCount={8}
        stroke={AXIS_COLOR}
        tick={{ fontSize: 11 }}
      />
      <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} tickFormatter={percentTick} />
      <Tooltip
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <TooltipCard title={`${label} points`}>
              <p>{percentLabel(Number(payload[0].value))} of the games</p>
            </TooltipCard>
          );
        }}
      />
      <ReferenceLine
        x={median}
        stroke={ACCENT_COLOR}
        strokeDasharray="4 4"
        label={{
          value: `Median ${fmtNum(median, { digits: 0 })}`,
          position: "top",
          fill: AXIS_COLOR,
          fontSize: 11,
        }}
      />
      <Line
        type="monotone"
        dataKey="share"
        stroke={SERIES_COLOR}
        strokeWidth={2}
        dot={false}
        activeDot={{ r: 4, fill: ACCENT_COLOR }}
        isAnimationActive={false}
      />
    </LineChart>
  </ResponsiveContainer>
);
