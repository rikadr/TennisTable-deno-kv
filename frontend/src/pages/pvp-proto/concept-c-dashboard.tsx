import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";
import { classNames } from "../../common/class-names";
import { RelativeTime } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";
import { PvpData } from "./pvp-data";
import { FormDots, PlayerPicker, SetChips, SideColors, SwapButton, pct } from "./pvp-ui";

type Props = {
  data: PvpData;
  colors: SideColors;
  select: (param: "player1" | "player2", value: string) => void;
  swap: () => void;
};

const TABS = ["Overview", "Games", "Sets", "Elo"] as const;
type Tab = (typeof TABS)[number];

export const ConceptDashboard: React.FC<Props> = ({ data, colors, select, swap }) => {
  const { p1, p2 } = data;
  const [tab, setTab] = useState<Tab>("Overview");
  const panel = (name: Tab) => classNames(tab === name ? "block" : "hidden", "md:block");

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 pb-6 text-primary-text">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-3 pb-2 bg-primary-background/95 backdrop-blur">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
          <PlayerPicker
            value={p1.id}
            exclude={p2.id}
            onChange={(v) => select("player1", v)}
            size={44}
            layout="responsive"
            nameClassName="text-sm sm:text-lg"
            subtitle={p1.rank ? `#${p1.rank} · ${fmtNum(p1.elo, { digits: 0 })}` : "Unranked"}
          />
          <div className="flex items-center gap-2">
            <span className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color: colors.c1 }}>
              {p1.wins}
            </span>
            <SwapButton onClick={swap} className="w-8 h-8" />
            <span className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color: colors.c2 }}>
              {p2.wins}
            </span>
          </div>
          <PlayerPicker
            value={p2.id}
            exclude={p1.id}
            onChange={(v) => select("player2", v)}
            size={44}
            layout="responsive"
            align="right"
            nameClassName="text-sm sm:text-lg"
            subtitle={p2.rank ? `#${p2.rank} · ${fmtNum(p2.elo, { digits: 0 })}` : "Unranked"}
          />
        </div>
        <div className="md:hidden mt-3 grid grid-cols-4 rounded-full bg-secondary-background/30 p-1 text-sm">
          {TABS.map((name) => (
            <button
              key={name}
              onClick={() => setTab(name)}
              className={classNames(
                "rounded-full py-1.5 font-semibold transition",
                tab === name ? "bg-tertiary-background text-tertiary-text" : "opacity-70",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
        <div className={classNames(panel("Overview"), "space-y-4")}>
          <Card title="Who wins the next game">
            <PredictionRing data={data} colors={colors} />
          </Card>
          <Card title="What stands out">
            <ul className="space-y-2 text-sm">
              {data.insights.map((insight, index) => (
                <li key={index} className="flex gap-2">
                  <span>{["📈", "🔥", "🧠", "😬"][index] ?? "•"}</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider opacity-60">Last 10</span>
              <FormDots games={data.games} colors={colors} />
            </div>
          </Card>
        </div>

        <div className={classNames(panel("Sets"), "space-y-4")}>
          <Card title="Sets and points">
            <ShareBar label="Sets won" a={p1.sets} b={p2.sets} colors={colors} />
            <ShareBar label="Points won" a={p1.points} b={p2.points} colors={colors} />
            <ShareBar label="Third sets won" a={p1.decidingWins} b={p2.decidingWins} colors={colors} />
            <ShareBar label="Close sets won" a={p1.closeSetWins} b={p2.closeSetWins} colors={colors} />
          </Card>
          <Card title="How the sets end">
            <p className="text-[11px] opacity-60 mb-2">
              The number of sets for each point difference. 9 includes all larger differences.
            </p>
            <MarginChart data={data} colors={colors} />
            <div className="flex justify-between text-[10px] opacity-70 mt-1">
              <span style={{ color: colors.c1 }}>← {p1.name} won by</span>
              <span style={{ color: colors.c2 }}>{p2.name} won by →</span>
            </div>
          </Card>
        </div>

        <div className={classNames(panel("Elo"), "space-y-4 md:col-span-2 lg:col-span-1")}>
          <Card title="Elo since the first game">
            <EloChart data={data} colors={colors} />
            <div className="mt-4 text-sm text-center">
              <span className="opacity-70">Net elo from these games: </span>
              <b style={{ color: p1.eloNet >= 0 ? colors.c1 : colors.c2 }}>
                {fmtNum(Math.abs(p1.eloNet), { signedPositive: true })} to {p1.eloNet >= 0 ? p1.name : p2.name}
              </b>
            </div>
          </Card>
        </div>

        <div className={classNames(panel("Games"), "md:col-span-2 lg:col-span-3")}>
          <Card title={`Games (${data.games.length})`}>
            <GamesTable data={data} colors={colors} />
          </Card>
        </div>
      </div>
    </div>
  );
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-2xl bg-secondary-background/15 ring-1 ring-secondary-background/40 p-3 sm:p-4">
    <h3 className="text-sm font-semibold mb-3">{title}</h3>
    {children}
  </section>
);

const ShareBar: React.FC<{ label: string; a: number; b: number; colors: SideColors }> = ({ label, a, b, colors }) => (
  <div className="mb-3 last:mb-0">
    <div className="flex justify-between text-xs mb-1">
      <span className="font-bold tabular-nums" style={{ color: colors.c1 }}>
        {fmtNum(a)} <span className="opacity-60 font-normal">({pct(a, a + b)}%)</span>
      </span>
      <span className="opacity-70">{label}</span>
      <span className="font-bold tabular-nums" style={{ color: colors.c2 }}>
        <span className="opacity-60 font-normal">({pct(b, a + b)}%)</span> {fmtNum(b)}
      </span>
    </div>
    <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
      <div style={{ width: `${pct(a, a + b)}%`, backgroundColor: colors.c1 }} />
      <div className="flex-1" style={{ backgroundColor: colors.c2 }} />
    </div>
  </div>
);

const PredictionRing: React.FC<{ data: PvpData; colors: SideColors }> = ({ data, colors }) => {
  if (!data.prediction) return <p className="text-sm opacity-70">No prediction for these players.</p>;
  const fraction = data.prediction.fraction;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke={colors.c2} strokeWidth="12" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={colors.c1}
          strokeWidth="12"
          strokeDasharray={`${fraction * circumference} ${circumference}`}
        />
      </svg>
      <div className="space-y-1 min-w-0">
        <div className="text-sm truncate">
          <b className="text-2xl tabular-nums" style={{ color: colors.c1 }}>
            {fmtNum(fraction * 100, { digits: 0 })}%
          </b>{" "}
          {data.p1.name}
        </div>
        <div className="text-sm truncate">
          <b className="text-2xl tabular-nums" style={{ color: colors.c2 }}>
            {fmtNum((1 - fraction) * 100, { digits: 0 })}%
          </b>{" "}
          {data.p2.name}
        </div>
        <div className="text-[11px] opacity-60">
          {fmtNum(data.prediction.confidence * 100, { digits: 0 })}% confidence ·{" "}
          <Link
            to={`/player/${data.p1.id}?tab=predictions&predictionTab=history&compareWith=${data.p2.id}`}
            className="underline"
          >
            History
          </Link>
        </div>
      </div>
    </div>
  );
};

const MarginChart: React.FC<{ data: PvpData; colors: SideColors }> = ({ data, colors }) => {
  const buckets = new Map<number, number>();
  for (const set of data.games.flatMap((g) => g.sets)) {
    const margin = Math.max(-9, Math.min(9, set.p2 - set.p1));
    buckets.set(margin, (buckets.get(margin) ?? 0) + 1);
  }
  const rows = Array.from({ length: 19 }, (_, i) => i - 9)
    .filter((m) => m !== 0)
    .map((margin) => ({ margin, count: buckets.get(margin) ?? 0 }));
  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 0, right: 0, bottom: 0, left: -32 }}>
          <XAxis
            dataKey="margin"
            tickFormatter={(m) => String(Math.abs(m))}
            stroke="rgb(var(--color-primary-text))"
            tick={{ fontSize: 10 }}
            interval={0}
          />
          <YAxis allowDecimals={false} stroke="rgb(var(--color-primary-text))" tick={{ fontSize: 10 }} />
          <Bar dataKey="count" isAnimationActive={false} radius={[3, 3, 0, 0]}>
            {rows.map((row) => (
              <Cell key={row.margin} fill={row.margin < 0 ? colors.c1 : colors.c2} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const EloChart: React.FC<{ data: PvpData; colors: SideColors }> = ({ data, colors }) => {
  const h2h = data.games.map((g) => ({
    time: g.time,
    h2h: g.p1Won ? g.p1EloAfter : g.p2EloAfter,
    fill: g.p1Won ? colors.c1 : colors.c2,
  }));
  return (
    <div>
      <div className="h-56 lg:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.eloSeries} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t) => new Date(t).toLocaleDateString("en-GB", { month: "short" })}
              stroke="rgb(var(--color-primary-text))"
              tick={{ fontSize: 10 }}
            />
            <YAxis
              domain={["dataMin - 20", "dataMax + 20"]}
              stroke="rgb(var(--color-primary-text))"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => String(Math.round(v))}
            />
            <ReferenceLine y={1000} stroke="rgb(var(--color-primary-text))" strokeOpacity={0.2} />
            <Tooltip
              labelFormatter={(t) => new Date(t as number).toLocaleDateString()}
              formatter={(v, name) => [fmtNum(v as number, { digits: 0 }), name === "p1" ? data.p1.name : data.p2.name]}
              contentStyle={{ background: "rgb(var(--color-primary-background))", border: "none", borderRadius: 8 }}
            />
            <Line dataKey="p1" stroke={colors.c1} dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
            <Line dataKey="p2" stroke={colors.c2} dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
            <Scatter
              data={h2h}
              dataKey="h2h"
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number; payload?: { fill: string } }) => (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={3.5}
                  fill={props.payload?.fill}
                  stroke="rgb(var(--color-primary-background))"
                  strokeWidth={1.5}
                />
              )}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] opacity-60 mt-1">A dot is a game between the 2 players, in the color of the winner.</p>
    </div>
  );
};

type Filter = "all" | "p1" | "p2";

const GamesTable: React.FC<{ data: PvpData; colors: SideColors }> = ({ data, colors }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const filtered = [...data.games].reverse().filter((g) => filter === "all" || (filter === "p1" ? g.p1Won : !g.p1Won));
  const shown = showAll ? filtered : filtered.slice(0, 10);

  return (
    <div>
      <div className="flex gap-1.5 mb-2 text-xs overflow-x-auto">
        {(
          [
            ["all", "All"],
            ["p1", `${data.p1.name} won`],
            ["p2", `${data.p2.name} won`],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={classNames(
              "rounded-full px-3 py-1 whitespace-nowrap ring-1 ring-secondary-background",
              filter === key ? "bg-secondary-background text-secondary-text" : "opacity-70",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="divide-y divide-secondary-background/40 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:divide-y-0">
        {shown.map((g) => (
          <button
            key={g.time}
            onClick={() => navigate(`/game?time=${g.time}`)}
            className="w-full grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2 py-2 px-1 text-left hover:bg-secondary-background/30 rounded lg:border-b lg:border-secondary-background/40"
          >
            <div className="flex items-center gap-1 font-black tabular-nums">
              <span style={{ color: colors.c1 }} className={classNames(!g.p1Won && "opacity-50")}>
                {g.setsP1 ?? (g.p1Won ? "W" : "L")}
              </span>
              <span className="opacity-40">–</span>
              <span style={{ color: colors.c2 }} className={classNames(g.p1Won && "opacity-50")}>
                {g.setsP2 ?? (g.p1Won ? "L" : "W")}
              </span>
            </div>
            <div className="min-w-0 flex items-center gap-2">
              {g.sets.length > 0 ? (
                <SetChips sets={g.sets} colors={colors} />
              ) : (
                <span className="text-xs opacity-50">No set score</span>
              )}
              {g.tags.some((tag) => tag.type === "tournament") && <span className="text-xs">🏆</span>}
            </div>
            <div className="text-right text-[11px] whitespace-nowrap">
              <div className="font-semibold">+{fmtNum(g.points)}</div>
              <div className="opacity-60">
                <RelativeTime date={new Date(g.time)} variant="short" />
              </div>
            </div>
          </button>
        ))}
      </div>
      {!showAll && filtered.length > shown.length && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full mt-2 py-2 text-sm font-semibold hover:bg-secondary-background/30 rounded"
        >
          Show all {filtered.length} games
        </button>
      )}
    </div>
  );
};
