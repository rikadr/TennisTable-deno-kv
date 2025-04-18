import React from "react";
import {
  BarChart,
  Bar,
  YAxis,
  Tooltip,
  TooltipProps,
  ResponsiveContainer,
  BarProps,
  ReferenceLine,
  XAxis,
} from "recharts";
import { BarRectangleItem } from "recharts/types/cartesian/Bar";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { ProfilePicture } from "../../player/profile-picture";
import { stringToColor } from "../../../common/string-to-color";
import { useEventDbContext } from "../../../wrappers/event-db-context";

export type CandelStickData = {
  playerId: string;
  rank: number;
  high: number;
  low: number;
  avg: number;
  current: number;
  time: number;
};
type PreparedData = Omit<CandelStickData, "avg" | "current"> & { avgCurrent: number[] };

const Candlestick = (props: unknown) => {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    low,
    high,
    avgCurrent: [avg, current],
  } = props as BarProps & BarRectangleItem & PreparedData;
  const isAboveAvg = current > avg;
  const color = isAboveAvg ? "green" : "red";
  const ratio = Math.abs(height / (avg - current));
  return (
    <g stroke={color} fill="none" strokeWidth="3">
      <path
        d={`
          M ${x},${y}
          L ${x},${y + height}
          L ${x + width},${y + height}
          L ${x + width},${y}
          L ${x},${y}
        `}
      />
      {/* bottom line */}
      {isAboveAvg ? (
        <path
          d={`
            M ${x + width / 2}, ${y + height}
            v ${(avg - low) * ratio}
          `}
        />
      ) : (
        <path
          d={`
            M ${x + width / 2}, ${y}
            v ${(current - low) * ratio}
          `}
        />
      )}
      {/* top line */}
      {isAboveAvg ? (
        <path
          d={`
            M ${x + width / 2}, ${y}
            v ${(current - high) * ratio}
          `}
        />
      ) : (
        <path
          d={`
            M ${x + width / 2}, ${y + height}
            v ${(avg - high) * ratio}
          `}
        />
      )}
    </g>
  );
};

const prepareData = (data: CandelStickData[]) => {
  return data.map(({ avg, current, ...other }) => {
    return {
      ...other,
      avgCurrent: [avg, current],
    };
  });
};

export const CandleStickChart: React.FC<{ rawData: CandelStickData[] }> = ({ rawData }) => {
  const context = useEventDbContext();
  const data = prepareData(rawData);
  const totalMinimum = data.reduce(
    (minValue, { low, high, avgCurrent: [avg, current] }) => (minValue = Math.min(minValue, low, high, avg, current)),
    100_000,
  );
  const totalMaximum = data.reduce(
    (maxValue, { low, high, avgCurrent: [avg, current] }) => (maxValue = Math.max(maxValue, low, high, avg, current)),
    -100_000,
  );

  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
        <Bar
          dataKey="avgCurrent"
          activeBar={<Candlestick />}
          shape={<Candlestick />}
          // label={{ position: "top" }}
        >
          {/* {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % 20]} />
          ))} */}
        </Bar>
        <XAxis
          dataKey="playerId"
          tickFormatter={(v) => context.playerName(v)}
          angle={45}
          minTickGap={-15}
          tickMargin={0}
          tickSize={5}
          orientation="bottom"
          tick={{ fill: "rgb(var(--color-primary-text))" }}
        />
        <YAxis
          type="number"
          domain={[totalMinimum, totalMaximum]}
          tickFormatter={(value) => value.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
          stroke="rgb(var(--color-primary-text))"
        />
        {/* <CartesianGrid strokeDasharray="3 3" /> */}
        <ReferenceLine y={1000} stroke="rgb(var(--color-primary-text))" label="1 000" />
        <Tooltip
          formatter={(value) => [value.toLocaleString("no-NO", { maximumFractionDigits: 0 }), "Elo"]}
          wrapperClassName="rounded-lg bg-primary-background"
          animationDuration={0}
          content={<CustomTooltip />}
          cursor={{ opacity: 0.2 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

// Custom tick component
// const CustomTick: React.FC<{
//   x: number;
//   y: number;
//   payload: { value: string };
// }> = ({ x, y, payload }) => {
//   return (
//     <text x={x} y={y} dy={10} textAnchor="middle" fill="#8884d8" style={{ fontSize: 12, fontWeight: "bold" }}>
//       {payload.value.toUpperCase()}
//     </text>
//   );
// };

const CustomTooltip: React.FC = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  const context = useEventDbContext();
  if (active && payload && payload.length) {
    const {
      playerId,
      rank,
      high,
      low,
      avgCurrent: [avg, current],
    } = payload[0].payload as unknown as PreparedData;
    return (
      <div className="relative p-2 bg-primary-background ring-1 ring-primary-text rounded-lg text-primary-text">
        <div className="absolute top-1 right-1">
          <ProfilePicture playerId={playerId} size={35} border={2} />
        </div>
        <h3 className="mb-4">
          {rank}:{" "}
          <span className="font-semibold" style={{ color: stringToColor(playerId || "1adagrsss") }}>
            {context.playerName(playerId)}
          </span>
        </h3>
        <p className="mb-4">
          {current - avg > 0 ? "🍀" : "🔻"}{" "}
          {Math.abs(current - avg).toLocaleString("no-NO", { maximumFractionDigits: 0 })} points{" "}
          {current - avg > 0 ? "above" : "below"} expected avg
        </p>
        <p>Max: {high.toLocaleString("no-NO", { maximumFractionDigits: 0 })}</p>
        <p>Min: {low.toLocaleString("no-NO", { maximumFractionDigits: 0 })}</p>
        <p>Avg: {avg.toLocaleString("no-NO", { maximumFractionDigits: 0 })}</p>
        <p>Current: {current.toLocaleString("no-NO", { maximumFractionDigits: 0 })}</p>
      </div>
    );
  }

  return null;
};
