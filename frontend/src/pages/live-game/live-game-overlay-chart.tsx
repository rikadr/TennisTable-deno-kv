import React, { useMemo, useRef } from "react";
import { replayWinPercentHistory, seededRandom } from "../game/game-win-replay";
import { computeLiveWinPrediction } from "./live-game-win-probability";
import { LiveGameState } from "./live-game-types";
import { OVERLAY_COLORS } from "./live-game-overlay-colors";

const CHART_WIDTH = 952;
const CHART_HEIGHT = 170;
/** Simulations for the 0-0 sample. It is one run, so it can afford less noise than the per-point replay. */
const START_SIMULATIONS = 5000;

type WinChanceHistory = { series: number[]; setBreaks: number[] };

/**
 * Player 1's win chance after every point of the match, with the pre-game chance
 * first. `available` is false when the stored point sequences do not match the
 * score, e.g. a live game that started before point tracking existed.
 *
 * The replay re-runs the Monte-Carlo model for every point, which blocks the main
 * thread for about 100 ms in a long match. It runs only while `enabled`. When it
 * is disabled, the last history stays, so the chart keeps its content while it
 * slides out.
 *
 * Without `includeCurrentSet` the history stops at the last completed set. A game
 * that ends mid-set is saved without that set, so the final chart leaves it out too.
 */
export function useWinChanceHistory(
  state: LiveGameState,
  preGameWinChance: number,
  preGameConfidence: number,
  enabled: boolean,
  includeCurrentSet: boolean,
): { available: boolean; history: WinChanceHistory | null } {
  const currentSequence = includeCurrentSet ? [state.currentSetSequence] : [];
  const currentSet = includeCurrentSet ? [state.currentSet] : [];
  const sequencesKey = JSON.stringify([...state.completedSetSequences, ...currentSequence]);
  const setsKey = JSON.stringify([...state.completedSets, ...currentSet]);
  const seed = state.startedAt ?? 0;

  const available = useMemo(() => {
    const sequences = JSON.parse(sequencesKey) as string[];
    const sets = JSON.parse(setsKey) as { player1: number; player2: number }[];
    return sequences.every((sequence, index) => {
      const set = sets[index];
      return !!set && sequence.length === set.player1 + set.player2;
    });
  }, [sequencesKey, setsKey]);

  const current = useMemo(() => {
    if (!enabled || !available) return null;
    const sequences = JSON.parse(sequencesKey) as string[];

    // The replay reads "W" as a point to its player 1, so the history is from player 1's view.
    const history = replayWinPercentHistory({
      pointSequences: sequences.map((sequence) => sequence.replace(/1/g, "W").replace(/2/g, "L")),
      preGameWinChance,
      preGameConfidence,
      seed,
      bestOf: state.bestOf,
    });

    const setBreaks: number[] = [];
    let total = 0;
    for (const sequence of sequences.slice(0, -1)) {
      total += sequence.length;
      setBreaks.push(total);
    }
    // The pre-game chance is for a best of 3, so simulate the 0-0 score at the match length that is set.
    const start = computeLiveWinPrediction({
      preGameWinChance,
      preGameConfidence,
      setsWon: { player1: 0, player2: 0 },
      currentSet: { player1: 0, player2: 0 },
      completedSets: [],
      bestOf: state.bestOf,
      simulations: START_SIMULATIONS,
      random: seededRandom(seed),
      skipConfidenceSimulation: true,
    }).player1WinChance;
    return { series: [start, ...history], setBreaks };
  }, [enabled, available, sequencesKey, preGameWinChance, preGameConfidence, seed, state.bestOf]);

  const last = useRef<WinChanceHistory | null>(null);
  if (current) last.current = current;

  return { available, history: current ?? last.current };
}

export const WinChanceChart: React.FC<{
  series: number[];
  setBreaks: number[];
  title: string;
  player1Name: string;
  player2Name: string;
}> = ({ series, setBreaks, title, player1Name, player2Name }) => {
  const pointsPlayed = series.length - 1;
  const span = Math.max(pointsPlayed, 1);
  const mid = CHART_HEIGHT / 2;
  const toX = (index: number) => (index * CHART_WIDTH) / span;
  const points = series.map((chance, index) => [toX(index), (1 - chance) * CHART_HEIGHT] as const);
  const format = (list: (readonly [number, number])[]) =>
    list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];
  // Clamping each half to the midline fills the area between the line and 50 %
  // in the colour of the player who is ahead.
  const areaAbove = `0,${mid} ${format(points.map(([x, y]) => [x, Math.min(y, mid)] as const))} ${lastX.toFixed(1)},${mid}`;
  const areaBelow = `0,${mid} ${format(points.map(([x, y]) => [x, Math.max(y, mid)] as const))} ${lastX.toFixed(1)},${mid}`;

  const bounds = [0, ...setBreaks.filter((index) => index < pointsPlayed), pointsPlayed];
  const setLabels = bounds.slice(0, -1).map((start, index) => ({
    label: `Set ${index + 1}`,
    centerX: toX((start + bounds[index + 1]) / 2),
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-5 text-[15px] font-semibold" style={{ color: OVERLAY_COLORS.softText }}>
        <span className="flex-grow uppercase font-bold tracking-[0.14em]" style={{ color: OVERLAY_COLORS.mutedText }}>
          {title}
        </span>
        <LegendItem color={OVERLAY_COLORS.player1} label={`${player1Name} ahead`} />
        <LegendItem color={OVERLAY_COLORS.player2} label={`${player2Name} ahead`} />
      </div>
      <div className="relative" style={{ width: CHART_WIDTH, height: CHART_HEIGHT }}>
        <svg
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="absolute inset-0 overflow-visible"
          aria-hidden="true"
        >
          <polygon points={areaAbove} fill={OVERLAY_COLORS.player1} fillOpacity={0.35} />
          <polygon points={areaBelow} fill={OVERLAY_COLORS.player2} fillOpacity={0.35} />
          <line
            x1={0}
            y1={mid}
            x2={CHART_WIDTH}
            y2={mid}
            stroke="rgba(255, 255, 255, 0.28)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          {setBreaks
            .filter((index) => index < pointsPlayed)
            .map((index) => (
              <line
                key={index}
                x1={toX(index)}
                y1={0}
                x2={toX(index)}
                y2={CHART_HEIGHT}
                stroke="rgba(255, 255, 255, 0.22)"
                strokeWidth={1}
              />
            ))}
          <polyline
            points={format(points)}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={lastX} cy={lastY} r={5} fill="#ffffff" stroke={OVERLAY_COLORS.panel} strokeWidth={2} />
        </svg>
      </div>
      <div className="relative h-[18px]" style={{ width: CHART_WIDTH }}>
        {setLabels.map(({ label, centerX }) => (
          <div
            key={label}
            className="absolute top-0 w-[60px] text-center text-sm font-semibold"
            style={{ left: centerX - 30, color: OVERLAY_COLORS.mutedText }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="flex items-center gap-2">
    <span className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: color }} />
    {label}
  </span>
);
