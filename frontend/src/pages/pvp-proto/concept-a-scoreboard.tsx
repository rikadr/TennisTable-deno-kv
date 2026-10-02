import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { classNames } from "../../common/class-names";
import { RelativeTime } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";
import { ProfilePicture } from "../player/profile-picture";
import { PvpData, PvpGame } from "./pvp-data";
import { FormDots, PlayerPicker, SetChips, SideColors, SwapButton, monthLabel, pct, shortDate } from "./pvp-ui";

type Props = {
  data: PvpData;
  colors: SideColors;
  select: (param: "player1" | "player2", value: string) => void;
  swap: () => void;
};

export const ConceptScoreboard: React.FC<Props> = ({ data, colors, select, swap }) => {
  const { p1, p2, games } = data;
  const total = games.length;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-4 text-primary-text">
      {/* Hero */}
      <section className="rounded-2xl bg-secondary-background/15 ring-1 ring-secondary-background/40 overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6 px-3 pt-4 pb-3 sm:px-8 sm:pt-6">
          <PlayerPicker
            value={p1.id}
            exclude={p2.id}
            onChange={(v) => select("player1", v)}
            layout="column"
            size={72}
            nameClassName="text-base sm:text-xl md:text-2xl"
            subtitle={<PlayerLine rank={p1.rank} elo={p1.elo} />}
          />
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-baseline gap-2 sm:gap-4 font-black tabular-nums leading-none">
              <span className="text-5xl sm:text-7xl" style={{ color: colors.c1 }}>
                {p1.wins}
              </span>
              <span className="text-2xl sm:text-4xl opacity-40">–</span>
              <span className="text-5xl sm:text-7xl" style={{ color: colors.c2 }}>
                {p2.wins}
              </span>
            </div>
            <span className="text-[11px] uppercase tracking-widest opacity-60">wins</span>
            <SwapButton onClick={swap} className="mt-1 w-8 h-8" />
          </div>
          <PlayerPicker
            value={p2.id}
            exclude={p1.id}
            onChange={(v) => select("player2", v)}
            layout="column"
            size={72}
            nameClassName="text-base sm:text-xl md:text-2xl"
            subtitle={<PlayerLine rank={p2.rank} elo={p2.elo} />}
          />
        </div>

        {/* Share of the wins */}
        <div className="flex h-2">
          <div style={{ width: `${pct(p1.wins, total)}%`, backgroundColor: colors.c1 }} />
          <div className="flex-1" style={{ backgroundColor: colors.c2 }} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-3 sm:px-8 text-xs sm:text-sm">
          <div className="opacity-80">
            <b>{total}</b> games since {shortDate(games[0].time)} {new Date(games[0].time).getFullYear()} · last{" "}
            <RelativeTime date={new Date(games[total - 1].time)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-60 uppercase text-[10px] tracking-wider">Last 10</span>
            <FormDots games={games} colors={colors} />
          </div>
        </div>
      </section>

      {/* Prediction */}
      {data.prediction && (
        <section className="rounded-2xl bg-secondary-background/15 ring-1 ring-secondary-background/40 px-3 py-3 sm:px-6">
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden xs:block shrink-0 text-xs uppercase tracking-wider opacity-60">Next game</span>
            <span className="font-bold tabular-nums w-12 text-right" style={{ color: colors.c1 }}>
              {fmtNum(data.prediction.fraction * 100, { digits: 0 })}%
            </span>
            <div className="flex-1 flex h-3 rounded-full overflow-hidden">
              <div style={{ width: `${data.prediction.fraction * 100}%`, backgroundColor: colors.c1 }} />
              <div className="flex-1" style={{ backgroundColor: colors.c2 }} />
            </div>
            <span className="font-bold tabular-nums w-12" style={{ color: colors.c2 }}>
              {fmtNum((1 - data.prediction.fraction) * 100, { digits: 0 })}%
            </span>
          </div>
          <div className="mt-1 flex justify-center gap-3 text-[11px] opacity-60">
            <span>Win chance · {fmtNum(data.prediction.confidence * 100, { digits: 0 })}% confidence</span>
            <Link
              to={`/player/${p1.id}?tab=predictions&predictionTab=history&compareWith=${p2.id}`}
              className="underline"
            >
              History
            </Link>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 items-start">
        <div className="space-y-4 lg:col-span-2">
          {/* Stats */}
          <section className="grid grid-cols-2 gap-2">
            <StatTile label="Sets won" a={p1.sets} b={p2.sets} colors={colors} />
            <StatTile label="Points won" a={p1.points} b={p2.points} colors={colors} />
            <StatTile label="Third sets won" a={p1.decidingWins} b={p2.decidingWins} colors={colors} />
            <StatTile label="Close sets won" a={p1.closeSetWins} b={p2.closeSetWins} colors={colors} />
            <StatTile label="Longest streak" a={p1.longestStreak} b={p2.longestStreak} colors={colors} />
            <StatTile
              label="Elo won from the other"
              a={Math.max(p1.eloNet, 0)}
              b={Math.max(p2.eloNet, 0)}
              format={(n) => (n > 0 ? `+${fmtNum(n)}` : "0")}
              colors={colors}
            />
            {data.currentStreak && (
              <div className="col-span-2 rounded-xl bg-secondary-background/15 ring-1 ring-secondary-background/40 px-3 py-2.5 flex items-center gap-3">
                <span className="text-2xl">🔥</span>
                <div className="text-sm">
                  <b style={{ color: data.currentStreak.player === "p1" ? colors.c1 : colors.c2 }}>
                    {data.currentStreak.player === "p1" ? p1.name : p2.name}
                  </b>{" "}
                  has won the last {data.currentStreak.length} {data.currentStreak.length === 1 ? "game" : "games"}
                </div>
              </div>
            )}
          </section>

          {/* Lead over time */}
          <section className="rounded-2xl bg-secondary-background/15 ring-1 ring-secondary-background/40 p-3 sm:p-4">
            <h3 className="text-sm font-semibold mb-1">The lead over time</h3>
            <p className="text-[11px] opacity-60 mb-2">
              Above the line {p1.name} leads, below the line {p2.name} leads
            </p>
            <LeadChart games={games} colors={colors} />
          </section>
        </div>

        {/* Games */}
        <section className="lg:col-span-3 rounded-2xl bg-secondary-background/15 ring-1 ring-secondary-background/40 overflow-hidden">
          <h3 className="text-sm font-semibold px-3 sm:px-4 pt-3">All games</h3>
          <GameList data={data} colors={colors} />
        </section>
      </div>
    </div>
  );
};

const PlayerLine: React.FC<{ rank?: number; elo: number }> = ({ rank, elo }) => (
  <span className="tabular-nums">
    {rank ? `#${rank} · ` : "Unranked · "}
    {fmtNum(elo, { digits: 0 })}
  </span>
);

const StatTile: React.FC<{
  label: string;
  a: number;
  b: number;
  colors: SideColors;
  format?: (n: number) => React.ReactNode;
}> = ({ label, a, b, colors, format = (n) => fmtNum(n) }) => {
  const share = a + b === 0 ? 50 : (a / (a + b)) * 100;
  return (
    <div className="rounded-xl bg-secondary-background/15 ring-1 ring-secondary-background/40 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider opacity-60 truncate">{label}</div>
      <div className="flex items-baseline justify-between font-bold tabular-nums text-lg">
        <span style={{ color: colors.c1 }} className={classNames(a < b && "opacity-60")}>
          {format(a)}
        </span>
        <span style={{ color: colors.c2 }} className={classNames(b < a && "opacity-60")}>
          {format(b)}
        </span>
      </div>
      <div className="flex h-1 rounded-full overflow-hidden mt-1">
        <div style={{ width: `${share}%`, backgroundColor: colors.c1 }} />
        <div className="flex-1" style={{ backgroundColor: colors.c2 }} />
      </div>
    </div>
  );
};

const LeadChart: React.FC<{ games: PvpGame[]; colors: SideColors }> = ({ games, colors }) => {
  const points = [{ time: games[0].time - 1, lead: 0 }, ...games.map((g) => ({ time: g.time, lead: g.lead }))];
  const max = Math.max(...points.map((p) => p.lead), 1);
  const min = Math.min(...points.map((p) => p.lead), -1);
  const split = max / (max - min);
  return (
    <div className="h-40 sm:h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="lead-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={colors.c1} stopOpacity={0.6} />
              <stop offset={split} stopColor={colors.c1} stopOpacity={0.15} />
              <stop offset={split} stopColor={colors.c2} stopOpacity={0.15} />
              <stop offset={1} stopColor={colors.c2} stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id="lead-line" x1="0" y1="0" x2="0" y2="1">
              <stop offset={split} stopColor={colors.c1} />
              <stop offset={split} stopColor={colors.c2} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => new Date(t).toLocaleDateString("en-GB", { month: "short" })}
            stroke="rgb(var(--color-primary-text))"
            tick={{ fontSize: 10 }}
            tickCount={6}
          />
          <YAxis allowDecimals={false} stroke="rgb(var(--color-primary-text))" tick={{ fontSize: 10 }} />
          <ReferenceLine y={0} stroke="rgb(var(--color-primary-text))" strokeOpacity={0.4} />
          <Tooltip
            labelFormatter={(t) => new Date(t as number).toLocaleDateString()}
            formatter={(v) => [v as number, "Lead"]}
            contentStyle={{ background: "rgb(var(--color-primary-background))", border: "none", borderRadius: 8 }}
          />
          <Area
            type="stepAfter"
            dataKey="lead"
            stroke="url(#lead-line)"
            strokeWidth={2}
            fill="url(#lead-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const GameList: React.FC<{ data: PvpData; colors: SideColors }> = ({ data, colors }) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const newestFirst = [...data.games].reverse();
  const shown = showAll ? newestFirst : newestFirst.slice(0, 12);

  let previousMonth = "";
  return (
    <div>
      <ul>
        {shown.map((g) => {
          const month = monthLabel(g.time);
          const header = month !== previousMonth;
          previousMonth = month;
          const winner = g.p1Won ? data.p1 : data.p2;
          const color = g.p1Won ? colors.c1 : colors.c2;
          return (
            <React.Fragment key={g.time}>
              {header && (
                <li className="px-3 sm:px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider opacity-60">{month}</li>
              )}
              <li>
                <button
                  onClick={() => navigate(`/game?time=${g.time}`)}
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 hover:bg-secondary-background/30 text-left transition-colors"
                >
                  <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: color }} />
                  <ProfilePicture playerId={winner.id} size={28} border={2} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold truncate text-sm">{winner.name}</span>
                      {g.setsP1 !== undefined && (
                        <span className="text-xs tabular-nums opacity-70 shrink-0">
                          {g.p1Won ? `${g.setsP1}–${g.setsP2}` : `${g.setsP2}–${g.setsP1}`}
                        </span>
                      )}
                      {g.tags
                        .filter((tag) => tag.type !== "achievement")
                        .map((tag) => (
                          <span key={tag.type} className="text-xs" title={tag.type}>
                            {tag.type === "first-meeting" ? "🆕" : "🏆"}
                          </span>
                        ))}
                    </div>
                    {g.sets.length > 0 && <SetChips sets={g.sets} colors={colors} />}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold tabular-nums">+{fmtNum(g.points)}</div>
                    <div className="text-[11px] opacity-60 whitespace-nowrap">
                      <RelativeTime date={new Date(g.time)} variant="short" />
                    </div>
                  </div>
                </button>
              </li>
            </React.Fragment>
          );
        })}
      </ul>
      {!showAll && newestFirst.length > shown.length && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-3 text-sm font-semibold hover:bg-secondary-background/30 border-t border-secondary-background/40"
        >
          Show all {newestFirst.length} games
        </button>
      )}
    </div>
  );
};
