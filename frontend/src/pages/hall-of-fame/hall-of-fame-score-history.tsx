import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";
import { relativeTimeString } from "../../common/date-utils";

type Props = {
  playerId: string;
};

export const HallOfFameScoreHistory = ({ playerId }: Props) => {
  const context = useEventDbContext();

  const history = useMemo(
    () => context.hallOfFame.getScoreHistoryForPlayer(playerId),
    [context.hallOfFame, playerId],
  );

  const chartData = useMemo(() => {
    return history.map((entry) => {
      const date = new Date(entry.time);
      const isToday = date.toDateString() === new Date().toDateString();
      const timeStr = date.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });
      const dateStr = date.toLocaleDateString("no-NO", { month: "short", day: "numeric" });
      return {
        time: entry.time,
        name: isToday ? `Today ${timeStr}` : `${dateStr} ${timeStr}`,
        score: entry.score,
      };
    });
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-primary-background/50 rounded-xl border border-white/10 text-primary-text/50 italic">
        No score history available for this player.
      </div>
    );
  }

  const latest = chartData[chartData.length - 1];
  const peak = chartData.reduce((max, e) => (e.score > max.score ? e : max), chartData[0]);

  return (
    <div className="w-full overflow-hidden bg-primary-background rounded-2xl border border-white/10 p-4 md:p-6 backdrop-blur-sm shadow-2xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between mb-4 md:mb-5">
        <h2 className="text-lg md:text-xl font-bold text-primary-text flex items-center gap-2 whitespace-nowrap">
          <span className="w-1.5 h-5 bg-blue-500 rounded-full" />
          Hall of Fame Score History
        </h2>
        <div className="flex items-center gap-1.5 text-primary-text whitespace-nowrap text-[10px] md:text-[11px] font-semibold">
          <div className="w-2 h-2 rounded-full bg-primary-text" />
          Score
        </div>
      </div>

      <div className="w-full h-[350px] md:h-[450px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="1 4"
              vertical={false}
              stroke="rgb(var(--color-primary-text))"
              opacity={0.1}
            />
            <XAxis
              dataKey="name"
              stroke="rgb(var(--color-primary-text))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dy={10}
              opacity={0.6}
            />
            <YAxis
              type="number"
              stroke="rgb(var(--color-primary-text))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dx={-5}
              opacity={0.6}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="rgb(var(--color-primary-text))"
              strokeWidth={3}
              animationDuration={300}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 px-2 py-3 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="text-primary-text/50 text-xs font-medium">Current</span>
          <span className="text-primary-text text-sm font-bold">{fmtNum(latest.score)} pts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-primary-text/50 text-xs font-medium">Peak</span>
          <span className="text-primary-text text-sm font-bold">{fmtNum(peak.score)} pts</span>
        </div>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const score = payload[0].value as number;
    return (
      <div className="bg-primary-background/95 border border-primary-text/20 p-2 rounded-lg shadow-xl backdrop-blur-md">
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <div className="flex items-center justify-between border-b border-primary-text/10 pb-1 mb-0.5">
            <span className="text-primary-text font-bold text-[11px] truncate pr-2">Score</span>
            <span className="text-primary-text/40 text-[9px] whitespace-nowrap">
              {relativeTimeString(new Date(data.time))}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-primary-text/80 text-[11px]">Total</span>
            </div>
            <span className="text-primary-text font-bold text-[11px]">{fmtNum(score)} pts</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};
