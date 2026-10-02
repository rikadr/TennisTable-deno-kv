import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { RelativeTime } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";
import { GameMarkers } from "../game/game-markers";
import { ProfilePicture } from "../player/profile-picture";
import { PvpData, PvpGame } from "./pvp-data";
import { PlayerPicker, SideColors, SwapButton, monthLabel, pct } from "./pvp-ui";

type Props = {
  data: PvpData;
  colors: SideColors;
  select: (param: "player1" | "player2", value: string) => void;
  swap: () => void;
};

/* ------------------------------------------------------------------------- */
/* Version 1: the pillars, made better. History next to them on a desktop    */
/* ------------------------------------------------------------------------- */

export const FocusedPillars: React.FC<Props> = ({ data, select, swap }) => {
  const { p1, p2 } = data;
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 text-primary-text">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start">
        <div className="space-y-3 lg:sticky lg:top-4">
          {/* Players */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
            <PlayerPicker
              value={p1.id}
              exclude={p2.id}
              onChange={(v) => select("player1", v)}
              layout="column"
              size={64}
              nameClassName="text-base sm:text-lg"
            />
            <SwapButton onClick={swap} className="mb-6" />
            <PlayerPicker
              value={p2.id}
              exclude={p1.id}
              onChange={(v) => select("player2", v)}
              layout="column"
              size={64}
              nameClassName="text-base sm:text-lg"
            />
          </div>

          {/* Pillars */}
          <div className="flex items-end gap-3 h-56 sm:h-64">
            <Pillar wins={p1.wins} other={p2.wins} />
            <Pillar wins={p2.wins} other={p1.wins} />
          </div>
          <div className="flex justify-between text-xs opacity-70 px-1 -mt-1">
            <span>{pct(p1.wins, data.games.length)}% of the games</span>
            <span>{data.games.length} games</span>
            <span>{pct(p2.wins, data.games.length)}% of the games</span>
          </div>

          <PredictionBlock data={data} />
        </div>

        <HistoryTable data={data} />
      </div>
    </div>
  );
};

const Pillar: React.FC<{ wins: number; other: number }> = ({ wins, other }) => {
  const height = Math.max((wins / Math.max(wins, other, 1)) * 100, 18);
  return (
    <div
      className="flex-1 rounded-t-[2rem] bg-secondary-background text-secondary-text flex flex-col items-center pt-3 shadow-lg transition-all duration-500"
      style={{ height: `${height}%` }}
    >
      <span className="text-5xl sm:text-6xl font-bold tabular-nums leading-none">{wins}</span>
      <span className="text-[11px] uppercase tracking-widest opacity-80 mt-1">wins</span>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Version 2: 1 split bar in the player colors, prediction bar under it      */
/* ------------------------------------------------------------------------- */

export const FocusedSplit: React.FC<Props> = ({ data, colors, select, swap }) => {
  const { p1, p2 } = data;
  const total = data.games.length;
  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-4 text-primary-text">
      <section className="rounded-2xl bg-secondary-background/20 ring-1 ring-secondary-background/40 p-3 sm:p-5 space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <PlayerPicker
            value={p1.id}
            exclude={p2.id}
            onChange={(v) => select("player1", v)}
            layout="responsive"
            size={56}
            nameClassName="text-base sm:text-xl"
          />
          <SwapButton onClick={swap} />
          <PlayerPicker
            value={p2.id}
            exclude={p1.id}
            onChange={(v) => select("player2", v)}
            layout="responsive"
            align="right"
            size={56}
            nameClassName="text-base sm:text-xl"
          />
        </div>

        {/* The win split */}
        <div>
          <div className="flex h-20 sm:h-24 rounded-xl overflow-hidden text-4xl sm:text-5xl font-black tabular-nums">
            <div
              className="flex items-center pl-4 min-w-[4.5rem]"
              style={{ width: `${pct(p1.wins, total)}%`, backgroundColor: colors.c1, color: colors.on1 }}
            >
              {p1.wins}
            </div>
            <div
              className="flex-1 flex items-center justify-end pr-4 min-w-[4.5rem]"
              style={{ backgroundColor: colors.c2, color: colors.on2 }}
            >
              {p2.wins}
            </div>
          </div>
          <div className="flex justify-between text-xs opacity-70 mt-1 px-0.5">
            <span>{pct(p1.wins, total)}%</span>
            <span>Wins in {total} games</span>
            <span>{pct(p2.wins, total)}%</span>
          </div>
        </div>

        {/* The prediction, in the same order */}
        {data.prediction && (
          <div>
            <div className="flex h-8 rounded-lg overflow-hidden text-sm font-bold tabular-nums">
              <div
                className="flex items-center pl-3 opacity-80"
                style={{ width: `${data.prediction.fraction * 100}%`, backgroundColor: colors.c1, color: colors.on1 }}
              >
                {fmtNum(data.prediction.fraction * 100, { digits: 0 })}%
              </div>
              <div
                className="flex-1 flex items-center justify-end pr-3 opacity-80"
                style={{ backgroundColor: colors.c2, color: colors.on2 }}
              >
                {fmtNum((1 - data.prediction.fraction) * 100, { digits: 0 })}%
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5">
              <span className="text-xs opacity-70">
                Win chance in the next game · {fmtNum(data.prediction.confidence * 100, { digits: 0 })}% confidence
              </span>
              <PredictionLink data={data} />
            </div>
          </div>
        )}
      </section>

      <HistoryTable data={data} />
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Shared parts                                                              */
/* ------------------------------------------------------------------------- */

const PredictionLink: React.FC<{ data: PvpData }> = ({ data }) => (
  <Link
    to={`/player/${data.p1.id}?tab=predictions&predictionTab=history&compareWith=${data.p2.id}`}
    className="inline-flex items-center gap-1 text-sm font-semibold text-tertiary-text bg-tertiary-background hover:bg-tertiary-background/70 px-3 py-1.5 rounded-full transition-colors"
  >
    Prediction history <span aria-hidden>→</span>
  </Link>
);

const PredictionBlock: React.FC<{ data: PvpData }> = ({ data }) => {
  if (!data.prediction) return null;
  const fraction = data.prediction.fraction;
  return (
    <section className="rounded-2xl bg-secondary-background/20 ring-1 ring-secondary-background/40 p-3 sm:p-4">
      <div className="text-xs uppercase tracking-wider opacity-70 text-center mb-2">Win chance in the next game</div>
      <div className="flex items-center gap-3">
        <span className="text-2xl sm:text-3xl font-bold tabular-nums w-16 text-center">
          {fmtNum(fraction * 100, { digits: 0 })}%
        </span>
        <div className="flex-1 h-3 rounded-full bg-secondary-background/30 overflow-hidden">
          <div className="h-full bg-secondary-background" style={{ width: `${fraction * 100}%` }} />
        </div>
        <span className="text-2xl sm:text-3xl font-bold tabular-nums w-16 text-center">
          {fmtNum((1 - fraction) * 100, { digits: 0 })}%
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <span className="text-xs opacity-60">
          {fmtNum(data.prediction.confidence * 100, { digits: 0 })}% confidence
        </span>
        <PredictionLink data={data} />
      </div>
    </section>
  );
};

/**
 * Every game in 1 line. The trophy is in the column of the winner, so the eye sees who won
 * from the side of the trophy. A month header gives the score of that month.
 */
const HistoryTable: React.FC<{ data: PvpData }> = ({ data }) => {
  const navigate = useNavigate();
  const { p1, p2 } = data;
  const months: { label: string; games: PvpGame[] }[] = [];
  for (const game of [...data.games].reverse()) {
    const label = monthLabel(game.time);
    if (months[months.length - 1]?.label !== label) months.push({ label, games: [] });
    months[months.length - 1].games.push(game);
  }
  const cols =
    "grid grid-cols-[minmax(0,1fr)_minmax(7rem,auto)_minmax(0,1fr)_2.75rem] sm:grid-cols-[minmax(0,1fr)_12rem_minmax(0,1fr)_4.5rem] md:grid-cols-[minmax(0,1fr)_12rem_minmax(0,1fr)_6.5rem] items-center gap-1";

  return (
    <section className="rounded-2xl bg-secondary-background/20 ring-1 ring-secondary-background/40 overflow-hidden">
      {/* Column headers stay on the screen while the list scrolls */}
      <div
        className={classNames(
          cols,
          "sticky top-0 z-10 bg-secondary-background text-secondary-text px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold",
        )}
      >
        <div className="flex items-center justify-center gap-1.5 min-w-0">
          <ProfilePicture playerId={p1.id} size={20} />
          <span className="truncate">{p1.name}</span>
        </div>
        <div className="text-center">Score</div>
        <div className="flex items-center justify-center gap-1.5 min-w-0">
          <ProfilePicture playerId={p2.id} size={20} />
          <span className="truncate">{p2.name}</span>
        </div>
        <div className="text-right">When</div>
      </div>

      {months.map((month) => {
        const p1Wins = month.games.filter((g) => g.p1Won).length;
        const p2Wins = month.games.length - p1Wins;
        return (
          <div key={month.label}>
            <div
              className={classNames(
                cols,
                "px-2 sm:px-3 py-1 bg-secondary-background/30 text-[11px] uppercase tracking-wider",
              )}
            >
              <div className={classNames("text-center tabular-nums", p1Wins > p2Wins ? "font-bold" : "opacity-50")}>
                {p1Wins}
              </div>
              <div className="text-center opacity-70">{month.label}</div>
              <div className={classNames("text-center tabular-nums", p2Wins > p1Wins ? "font-bold" : "opacity-50")}>
                {p2Wins}
              </div>
              <div />
            </div>
            <ul className="divide-y divide-primary-text/10">
              {month.games.map((g) => (
                <li key={g.time}>
                  <button
                    onClick={() => navigate(`/game?time=${g.time}`)}
                    className={classNames(
                      cols,
                      "w-full px-2 sm:px-3 py-1 text-left hover:bg-secondary-background hover:text-secondary-text transition-colors",
                    )}
                  >
                    <WinnerCell won={g.p1Won} points={g.points} />
                    <div className="text-center leading-tight">
                      <span className="font-semibold tabular-nums text-sm">
                        {g.setsP1 !== undefined ? `${g.setsP1} - ${g.setsP2}` : "–"}
                      </span>
                      <GameMarkers score={g.score} />
                      {g.sets.length > 0 && (
                        <span className="block sm:inline sm:ml-2 text-[10px] sm:text-xs opacity-60 italic tabular-nums whitespace-nowrap">
                          {g.sets.map((set) => `${set.p1}-${set.p2}`).join(", ")}
                        </span>
                      )}
                    </div>
                    <WinnerCell won={!g.p1Won} points={g.points} />
                    <div className="text-right text-[11px] sm:text-xs opacity-60 whitespace-nowrap">
                      <RelativeTime date={new Date(g.time)} variant="auto" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
};

const WinnerCell: React.FC<{ won: boolean; points: number }> = ({ won, points }) => (
  <div className="flex items-center justify-center gap-1">
    {won && (
      <>
        <span className="text-base sm:text-lg">🏆</span>
        <span className="text-[11px] sm:text-xs italic opacity-70 tabular-nums">+{fmtNum(points)}</span>
      </>
    )}
  </div>
);
