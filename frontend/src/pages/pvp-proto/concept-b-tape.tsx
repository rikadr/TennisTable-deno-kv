import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { ProfilePicture } from "../player/profile-picture";
import { PvpData } from "./pvp-data";
import { PlayerPicker, SetChips, SideColors, SwapButton, monthLabel, pct, shortDate } from "./pvp-ui";

type Props = {
  data: PvpData;
  colors: SideColors;
  select: (param: "player1" | "player2", value: string) => void;
  swap: () => void;
};

export const ConceptTape: React.FC<Props> = ({ data, colors, select, swap }) => {
  const navigate = useNavigate();
  const { p1, p2, games } = data;
  const total = games.length;
  const prediction = data.prediction;

  const rows: { label: string; a: number; b: number; format?: (n: number) => string; lowerIsBetter?: boolean }[] = [
    { label: "Wins", a: p1.wins, b: p2.wins },
    { label: "Win %", a: pct(p1.wins, total), b: pct(p2.wins, total), format: (n) => `${n}%` },
    { label: "Sets", a: p1.sets, b: p2.sets },
    { label: "Points", a: p1.points, b: p2.points, format: (n) => fmtNum(n) ?? "" },
    { label: "Third sets", a: p1.decidingWins, b: p2.decidingWins },
    { label: "Close sets", a: p1.closeSetWins, b: p2.closeSetWins },
    { label: "Best streak", a: p1.longestStreak, b: p2.longestStreak },
    {
      label: "Elo taken",
      a: Math.max(p1.eloNet, 0),
      b: Math.max(p2.eloNet, 0),
      format: (n) => (n > 0 ? `+${fmtNum(n)}` : "0"),
    },
    { label: "Elo now", a: p1.elo, b: p2.elo, format: (n) => fmtNum(n, { digits: 0 }) ?? "" },
    ...(prediction
      ? [
          {
            label: "Next game",
            a: Math.round(prediction.fraction * 100),
            b: 100 - Math.round(prediction.fraction * 100),
            format: (n: number) => `${n}%`,
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-4 text-primary-text">
      {/* Poster */}
      <section className="relative rounded-2xl overflow-hidden">
        <div className="grid grid-cols-2">
          <div
            className="pt-4 pb-5 pl-3 pr-9 sm:pl-8 sm:pr-24"
            style={{ backgroundColor: colors.c1, color: colors.on1, clipPath: "polygon(0 0,100% 0,88% 100%,0 100%)" }}
          >
            <PlayerPicker
              value={p1.id}
              exclude={p2.id}
              onChange={(v) => select("player1", v)}
              layout="column"
              size={80}
              pictureRing
              nameClassName="text-sm sm:text-2xl uppercase tracking-tight"
              subtitle={p1.rank ? `Rank #${p1.rank}` : "Unranked"}
            />
            <div className="text-center text-5xl sm:text-7xl font-black tabular-nums leading-none mt-2">{p1.wins}</div>
          </div>
          <div
            className="pt-4 pb-5 pr-3 pl-9 sm:pr-8 sm:pl-24 -ml-[12%]"
            style={{
              backgroundColor: colors.c2,
              color: colors.on2,
              clipPath: "polygon(12% 0,100% 0,100% 100%,0 100%)",
            }}
          >
            <PlayerPicker
              value={p2.id}
              exclude={p1.id}
              onChange={(v) => select("player2", v)}
              layout="column"
              size={80}
              pictureRing
              nameClassName="text-sm sm:text-2xl uppercase tracking-tight"
              subtitle={p2.rank ? `Rank #${p2.rank}` : "Unranked"}
            />
            <div className="text-center text-5xl sm:text-7xl font-black tabular-nums leading-none mt-2">{p2.wins}</div>
          </div>
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
          <span className="rounded-full bg-primary-background text-primary-text font-black italic w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center text-lg sm:text-2xl shadow-lg">
            VS
          </span>
          <SwapButton onClick={swap} className="w-8 h-8 shadow-lg" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
        <div className="space-y-4">
          {/* Tale of the tape */}
          <section className="rounded-2xl bg-secondary-background/15 ring-1 ring-secondary-background/40 px-3 py-4 sm:px-6">
            <h3 className="text-center text-xs uppercase tracking-[0.3em] opacity-70 mb-3">Tale of the tape</h3>
            <div className="space-y-2.5">
              {rows.map((row) => (
                <TapeRow key={row.label} {...row} colors={colors} />
              ))}
            </div>
            <p className="text-center text-[11px] opacity-50 mt-4">
              {total} games since {shortDate(games[0].time)} {new Date(games[0].time).getFullYear()}
            </p>
          </section>

          {/* Biggest wins */}
          <section className="grid grid-cols-2 gap-2">
            {[
              { side: p1, color: colors.c1 },
              { side: p2, color: colors.c2 },
            ].map(({ side, color }) => (
              <button
                key={side.id}
                disabled={!side.biggestWin}
                onClick={() => side.biggestWin && navigate(`/game?time=${side.biggestWin.time}`)}
                className="rounded-2xl bg-secondary-background/15 ring-1 ring-secondary-background/40 p-3 text-left hover:ring-primary-text/40 transition min-w-0"
              >
                <div className="text-[10px] uppercase tracking-wider opacity-60">Biggest win</div>
                <div className="font-bold truncate" style={{ color }}>
                  {side.name}
                </div>
                {side.biggestWin ? (
                  <>
                    <div className="my-1.5">
                      <SetChips sets={side.biggestWin.sets} colors={colors} size="md" />
                    </div>
                    <div className="text-[11px] opacity-60">
                      {shortDate(side.biggestWin.time)} {new Date(side.biggestWin.time).getFullYear()}
                    </div>
                  </>
                ) : (
                  <div className="text-xs opacity-60 mt-1">No win with a set score</div>
                )}
              </button>
            ))}
          </section>
        </div>

        {/* Timeline */}
        <section className="rounded-2xl bg-secondary-background/15 ring-1 ring-secondary-background/40 py-4">
          <h3 className="text-center text-xs uppercase tracking-[0.3em] opacity-70 mb-1">Every game</h3>
          <Timeline data={data} colors={colors} />
        </section>
      </div>
    </div>
  );
};

const TapeRow: React.FC<{
  label: string;
  a: number;
  b: number;
  colors: SideColors;
  format?: (n: number) => string;
}> = ({ label, a, b, colors, format = (n) => String(n) }) => {
  const max = Math.max(a, b, 1);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] items-center gap-2">
      <div className="flex items-center justify-end gap-2">
        <span className={classNames("tabular-nums text-sm sm:text-base", a >= b ? "font-black" : "opacity-60")}>
          {format(a)}
        </span>
        <div className="w-1/2 flex justify-end">
          <div
            className="h-2.5 rounded-l-full"
            style={{ width: `${(a / max) * 100}%`, backgroundColor: colors.c1, opacity: a >= b ? 1 : 0.45 }}
          />
        </div>
      </div>
      <div className="text-center text-[10px] sm:text-xs uppercase tracking-wider opacity-70 leading-tight">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-1/2">
          <div
            className="h-2.5 rounded-r-full"
            style={{ width: `${(b / max) * 100}%`, backgroundColor: colors.c2, opacity: b >= a ? 1 : 0.45 }}
          />
        </div>
        <span className={classNames("tabular-nums text-sm sm:text-base", b >= a ? "font-black" : "opacity-60")}>
          {format(b)}
        </span>
      </div>
    </div>
  );
};

const Timeline: React.FC<{ data: PvpData; colors: SideColors }> = ({ data, colors }) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const newestFirst = [...data.games].reverse();
  const shown = showAll ? newestFirst : newestFirst.slice(0, 14);
  let previousMonth = "";

  return (
    <div className="relative">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary-text/20" />
      <ul className="relative">
        {shown.map((g) => {
          const month = monthLabel(g.time);
          const header = month !== previousMonth;
          previousMonth = month;
          const color = g.p1Won ? colors.c1 : colors.c2;
          const winnerSets = g.p1Won ? g.setsP1 : g.setsP2;
          const loserSets = g.p1Won ? g.setsP2 : g.setsP1;
          const card = (
            <button
              onClick={() => navigate(`/game?time=${g.time}`)}
              className={classNames(
                "rounded-lg px-2 py-1.5 bg-primary-background ring-1 ring-secondary-background/50 hover:ring-primary-text/50 transition text-left max-w-full",
                g.p1Won ? "ml-auto" : "mr-auto",
              )}
            >
              <div className={classNames("flex items-center gap-1.5", g.p1Won && "flex-row-reverse")}>
                <span className="font-bold tabular-nums text-sm">
                  {winnerSets !== undefined ? `${winnerSets}–${loserSets}` : "Won"}
                </span>
                <span className="text-[11px] opacity-60">+{fmtNum(g.points)}</span>
                {g.tags.some((tag) => tag.type === "tournament") && <span className="text-xs">🏆</span>}
                {g.tags.some((tag) => tag.type === "first-meeting") && <span className="text-xs">🆕</span>}
              </div>
              {g.sets.length > 0 && (
                <div className={classNames("mt-1 flex", g.p1Won && "justify-end")}>
                  <SetChips sets={g.sets} colors={colors} />
                </div>
              )}
            </button>
          );
          return (
            <React.Fragment key={g.time}>
              {header && (
                <li className="relative flex justify-center py-2">
                  <span className="rounded-full bg-secondary-background text-secondary-text text-[10px] uppercase tracking-wider px-2.5 py-0.5">
                    {month}
                  </span>
                </li>
              )}
              <li className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-center px-2 sm:px-4 py-1">
                <div className="flex justify-end min-w-0">{g.p1Won && card}</div>
                <div className="flex justify-center">
                  <span className="rounded-full ring-2 ring-primary-background" style={{ backgroundColor: color }}>
                    <ProfilePicture playerId={g.p1Won ? data.p1.id : data.p2.id} size={20} />
                  </span>
                </div>
                <div className="flex min-w-0">{!g.p1Won && card}</div>
              </li>
            </React.Fragment>
          );
        })}
      </ul>
      {!showAll && newestFirst.length > shown.length && (
        <div className="relative flex justify-center pt-2">
          <button
            onClick={() => setShowAll(true)}
            className="rounded-full bg-tertiary-background text-tertiary-text text-sm font-semibold px-4 py-1.5 hover:bg-tertiary-background/70"
          >
            Show all {newestFirst.length} games
          </button>
        </div>
      )}
    </div>
  );
};
