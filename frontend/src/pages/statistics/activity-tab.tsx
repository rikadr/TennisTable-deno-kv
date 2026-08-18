import React, { useMemo, useState } from "react";
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
  XAxis,
  YAxis,
} from "recharts";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { PillSelect } from "../../common/pill-select";
import { getPeriodKey, Period } from "../../common/period-utils";
import { ContentCard } from "../player/content-card";
import { NotEnoughGames, StatTile, StatTileRow } from "./stat-tile";
import { ACCENT_COLOR, AXIS_COLOR, percentLabel, percentTick, SERIES_COLOR, TooltipCard } from "./percent-chart";
import {
  activityHighlights,
  activityTrend,
  minuteOfDayLabel,
  timeOfDayShares,
  weekdayShares,
} from "./statistics-aggregations";

const TREND_OPTIONS: { value: Period; label: string }[] = [
  { value: "month", label: "Monthly" },
  { value: "week", label: "Weekly" },
];

const formatPeriodLabel = (key: string, period: Period): string => {
  if (period === "month") {
    const [year, month] = key.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
  }
  const [, year, month, day] = key.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const ActivityTab: React.FC = () => {
  const context = useEventDbContext();
  const [period, setPeriod] = useState<Period>("month");

  // `context.games` sorts and returns a new array on every read, so it is
  // pinned here. Depending on it directly would rebuild every chart on every
  // render.
  const games = useMemo(() => context.games, [context]);
  const trend = useMemo(() => activityTrend(games, period), [games, period]);
  const weekdays = useMemo(() => weekdayShares(games), [games]);
  const slots = useMemo(() => timeOfDayShares(games), [games]);
  const highlights = useMemo(() => activityHighlights(games), [games]);

  const tournaments = useMemo(() => {
    if (period !== "month" || trend.length === 0) return [];
    const first = trend[0].timestamp;
    return context.eventStore.tournamentsProjector
      .getTournamentConfigs()
      .filter((tournament) => tournament.startDate >= first && tournament.startDate <= Date.now())
      .map((tournament) => ({ name: tournament.name, key: getPeriodKey(new Date(tournament.startDate), "month") }));
  }, [context, period, trend]);

  if (highlights === undefined) {
    return (
      <ContentCard title="Activity">
        <NotEnoughGames />
      </ContentCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StatTileRow>
        <StatTile label="Busiest day" value={highlights.busiestWeekday.weekday} note={`${percentLabel(highlights.busiestWeekday.share)} of all games`} />
        <StatTile label="Busiest time" value={highlights.busiestSlot.slot} />
        <StatTile label="Median start time" value={minuteOfDayLabel(highlights.medianMinuteOfDay)} />
        <StatTile label="Played Monday to Friday" value={percentLabel(highlights.weekdayShare)} />
      </StatTileRow>

      <ContentCard
        title="Activity over time"
        description="Each period against the busiest one, which reads 100%. The chart shows when the league is busy, not how many games it plays."
        action={<PillSelect label="" options={TREND_OPTIONS} value={period} onChange={setPeriod} />}
      >
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trend} margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.3} />
            <XAxis
              dataKey="period"
              stroke={AXIS_COLOR}
              tick={{ fontSize: 11 }}
              tickFormatter={(key: string) => formatPeriodLabel(key, period)}
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={percentTick} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <TooltipCard title={formatPeriodLabel(String(label), period)}>
                    <p>{percentLabel(Number(payload[0].value))} of the busiest {period}</p>
                  </TooltipCard>
                );
              }}
            />
            {tournaments.map((tournament) => (
              <ReferenceLine
                key={`${tournament.key}-${tournament.name}`}
                x={tournament.key}
                stroke={ACCENT_COLOR}
                strokeDasharray="8 4"
                strokeWidth={2}
                label={{
                  value: tournament.name,
                  angle: -5,
                  textAnchor: "end",
                  position: "insideTopRight",
                  offset: 10,
                  style: { fontSize: "11px", fill: ACCENT_COLOR },
                }}
              />
            ))}
            <Line type="monotone" dataKey="share" stroke={SERIES_COLOR} strokeWidth={3} dot={false} activeDot={{ r: 5, fill: ACCENT_COLOR }} />
          </LineChart>
        </ResponsiveContainer>
      </ContentCard>

      <ContentCard title="Day of the week" description="Share of all games played on each day of the week.">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={weekdays} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.3} />
            <XAxis dataKey="short" stroke={AXIS_COLOR} tick={{ fontSize: 12 }} />
            <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} tickFormatter={percentTick} />
            <Tooltip
              cursor={{ fill: AXIS_COLOR, fillOpacity: 0.1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0].payload as { weekday: string; share: number };
                return (
                  <TooltipCard title={entry.weekday}>
                    <p>{percentLabel(entry.share)} of all games</p>
                  </TooltipCard>
                );
              }}
            />
            <Bar dataKey="share" fill={SERIES_COLOR} stroke={ACCENT_COLOR} strokeWidth={1} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ContentCard>

      <ContentCard
        title="Time of the day"
        description="Each 15 minute slot against the busiest slot of the day, which reads 100%."
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={slots} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.3} />
            <XAxis
              dataKey="slot"
              stroke={AXIS_COLOR}
              tick={{ fontSize: 10 }}
              interval={Math.max(Math.floor(slots.length / 10), 3)}
            />
            <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={percentTick} />
            <Tooltip
              cursor={{ fill: AXIS_COLOR, fillOpacity: 0.1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0].payload as { slot: string; share: number };
                return (
                  <TooltipCard title={entry.slot}>
                    <p>{percentLabel(entry.share)} of the busiest slot</p>
                  </TooltipCard>
                );
              }}
            />
            <Bar dataKey="share" stroke={ACCENT_COLOR} strokeWidth={1} radius={[2, 2, 0, 0]}>
              {slots.map((slot) => (
                <Cell key={slot.slot} fill={SERIES_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ContentCard>
    </div>
  );
};
