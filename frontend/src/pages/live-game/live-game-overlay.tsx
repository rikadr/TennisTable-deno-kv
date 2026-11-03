import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLiveGameQuery } from "./use-live-game";
import { LiveGameSetPoint, LiveGameState } from "./live-game-types";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { getServeInfo } from "../../common/serve-tracker";
import { useLiveWinPrediction } from "./use-live-win-prediction";
import { useWinChanceHistory, WinChanceChart } from "./live-game-overlay-chart";
import { OVERLAY_COLORS } from "./live-game-overlay-colors";

const POLL_FALLBACK_MS = 1_000;

// The graphics are laid out on a 1920x1080 stage, scaled to fit the window.
const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
// Title-safe margin: 5 % of the stage height.
const SAFE_MARGIN = 54;
const SCOREBOARD_SCALE = 1.3;

const BOTTOM_PANEL_WIDTH = 1000;
const CHART_PANEL_HEIGHT = 256;
const PANEL_GAP = 12;
/** How long the win chance chart shows after a set ends. */
const CHART_SHOW_MS = 20_000;
const SLIDE = "700ms cubic-bezier(0.2, 0.8, 0.2, 1)";
/** Width of the white pill that marks the split in the win chance bar. */
const DIVIDER_WIDTH_PX = 6;

const ROW_HEIGHT = 44;
const CELL_WIDTH = 44;

export const LiveGameOverlay: React.FC = () => {
  const [searchParams] = useSearchParams();
  const zoom = parseFloat(searchParams.get("zoom") || "1") || 1;
  // The overlay is captured on a screen next to the table, where the tab counts
  // as a background tab. It must keep the poll running.
  const liveGameQuery = useLiveGameQuery({ refetchIntervalMs: POLL_FALLBACK_MS, refetchInBackground: true });
  const scale = useStageScale();

  const state = liveGameQuery.data;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ backgroundColor: OVERLAY_COLORS.chromaGreen }}>
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden"
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {/* A finished game stays on screen until the next game starts. */}
        {state && state.player1Id && state.player2Id && state.startedAt !== null && (
          <OverlayGraphics
            key={state.startedAt}
            state={state}
            player1Id={state.player1Id}
            player2Id={state.player2Id}
            zoom={zoom}
          />
        )}
      </div>
    </div>
  );
};

const OverlayGraphics: React.FC<{ state: LiveGameState; player1Id: string; player2Id: string; zoom: number }> = ({
  state,
  player1Id,
  player2Id,
  zoom,
}) => {
  const context = useEventDbContext();
  const player1Name = context.playerName(player1Id);
  const player2Name = context.playerName(player2Id);
  const isOver = state.finishedAt !== null;

  const prediction = useLiveWinPrediction({
    player1Id,
    player2Id,
    setsWon: state.setsWon,
    currentSet: state.currentSet,
    completedSets: state.completedSets,
  });
  const history = useWinChanceHistory(state, prediction.preGameWinChance, prediction.preGameConfidence);
  const chartAfterSet = useShowAfterIncrease(state.completedSets.length, CHART_SHOW_MS);
  const gain = useLastPointGain(state, prediction.player1WinChance);

  const showBar = !isOver && prediction.hasPrediction;
  const showChart = !!history && (isOver || chartAfterSet);
  const { server } = getServeInfo(state.currentSet, state.firstServer ?? 1);

  const winnerName = state.setsWon.player1 > state.setsWon.player2 ? player1Name : player2Name;
  const chartTitle = isOver
    ? `Final: ${winnerName} wins ${Math.max(state.setsWon.player1, state.setsWon.player2)}–${Math.min(state.setsWon.player1, state.setsWon.player2)}`
    : `Win chance after set ${state.completedSets.length}`;

  return (
    <>
      <div className="absolute inset-x-0 flex justify-center" style={{ top: SAFE_MARGIN }}>
        <div style={{ zoom: SCOREBOARD_SCALE * zoom }}>
          <Scoreboard
            player1Name={player1Name}
            player2Name={player2Name}
            completedSets={state.completedSets}
            currentSet={state.currentSet}
            server={isOver ? null : server}
            hideCurrentSet={isOver}
          />
        </div>
      </div>

      <div className="absolute inset-x-0 flex justify-center" style={{ bottom: SAFE_MARGIN }}>
        <div className="flex flex-col" style={{ zoom, width: BOTTOM_PANEL_WIDTH }}>
          {showBar && (
            <WinChanceBar
              player1Name={player1Name}
              player2Name={player2Name}
              player1WinChance={prediction.player1WinChance}
              lowData={prediction.hasUnranked}
              gain={gain}
            />
          )}
          {/* The chart comes in from the bottom edge and its growing slot pushes the bar up. */}
          <div
            className="relative"
            style={{
              height: showChart ? CHART_PANEL_HEIGHT + (showBar ? PANEL_GAP : 0) : 0,
              transition: `height ${SLIDE}`,
            }}
          >
            <div
              className="absolute left-0 rounded-lg box-border px-6 py-4"
              style={{
                top: showBar ? PANEL_GAP : 0,
                width: BOTTOM_PANEL_WIDTH,
                height: CHART_PANEL_HEIGHT,
                backgroundColor: OVERLAY_COLORS.panel,
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.35)",
                transform: `translateY(${showChart ? 0 : SAFE_MARGIN + CHART_PANEL_HEIGHT + 2 * PANEL_GAP}px)`,
                transition: `transform ${SLIDE}`,
              }}
            >
              {history && (
                <WinChanceChart
                  series={history.series}
                  setBreaks={history.setBreaks}
                  title={chartTitle}
                  player1Name={player1Name}
                  player2Name={player2Name}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const Scoreboard: React.FC<{
  player1Name: string;
  player2Name: string;
  completedSets: LiveGameSetPoint[];
  currentSet: LiveGameSetPoint;
  server: 1 | 2 | null;
  hideCurrentSet: boolean;
}> = ({ player1Name, player2Name, completedSets, currentSet, server, hideCurrentSet }) => (
  <div className="inline-flex rounded-md overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0, 0, 0, 0.35)" }}>
    <div className="flex flex-col" style={{ backgroundColor: OVERLAY_COLORS.panel }}>
      <NameRow name={player1Name} keyColor={OVERLAY_COLORS.player1} serving={server === 1} divider />
      <NameRow name={player2Name} keyColor={OVERLAY_COLORS.player2} serving={server === 2} />
    </div>
    {completedSets.map((set, index) => (
      <CompletedSetColumn key={index} set={set} />
    ))}
    {!hideCurrentSet && (
      <div className="flex flex-col" style={{ backgroundColor: "#ffffff" }}>
        <div style={{ ...cellStyle, ...currentCell, borderBottom: `1px solid ${OVERLAY_COLORS.currentSetDivider}` }}>
          {currentSet.player1}
        </div>
        <div style={{ ...cellStyle, ...currentCell }}>{currentSet.player2}</div>
      </div>
    )}
  </div>
);

const cellStyle: React.CSSProperties = {
  width: CELL_WIDTH,
  height: ROW_HEIGHT,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  lineHeight: 1,
};

const winnerCell: React.CSSProperties = { backgroundColor: OVERLAY_COLORS.accent, color: "#111111", fontWeight: 800 };
const loserCell: React.CSSProperties = { color: OVERLAY_COLORS.mutedText, fontWeight: 600 };
const currentCell: React.CSSProperties = { color: "#000000", fontWeight: 800 };

/** The tab at the start of the row is the player's colour in the win chance graphics. */
const NameRow: React.FC<{ name: string; keyColor: string; serving: boolean; divider?: boolean }> = ({
  name,
  keyColor,
  serving,
  divider,
}) => (
  <div
    className="flex items-center gap-2.5 pr-[18px]"
    style={{
      height: ROW_HEIGHT,
      boxSizing: "border-box",
      borderBottom: divider ? `1px solid ${OVERLAY_COLORS.divider}` : undefined,
    }}
  >
    <span className="self-stretch shrink-0 w-1.5" style={{ backgroundColor: keyColor }} />
    <span
      className="rounded-full shrink-0"
      style={{ width: 10, height: 10, backgroundColor: serving ? OVERLAY_COLORS.accent : "transparent" }}
    />
    <span className="text-white text-xl font-semibold whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px]">
      {name}
    </span>
  </div>
);

const CompletedSetColumn: React.FC<{ set: LiveGameSetPoint }> = ({ set }) => {
  const player1Won = set.player1 > set.player2;
  return (
    <div
      className="flex flex-col"
      style={{ backgroundColor: OVERLAY_COLORS.panel, borderLeft: `1px solid ${OVERLAY_COLORS.divider}` }}
    >
      <div
        style={{
          ...cellStyle,
          ...(player1Won ? winnerCell : loserCell),
          borderBottom: `1px solid ${OVERLAY_COLORS.divider}`,
        }}
      >
        {set.player1}
      </div>
      <div style={{ ...cellStyle, ...(player1Won ? loserCell : winnerCell) }}>{set.player2}</div>
    </div>
  );
};

type PointGain = { player: 1 | 2; points: number };

const WinChanceBar: React.FC<{
  player1Name: string;
  player2Name: string;
  player1WinChance: number;
  lowData: boolean;
  gain: PointGain | null;
}> = ({ player1Name, player2Name, player1WinChance, lowData, gain }) => {
  const player1Percent = Math.round(player1WinChance * 100);
  // The divider width is taken off the span, so at 0 % and 100 % the divider sits
  // flush with the end of the bar and stays in view.
  const split = `calc(${DIVIDER_WIDTH_PX / 2}px + ${player1WinChance} * (100% - ${DIVIDER_WIDTH_PX}px))`;

  return (
    <div
      className="flex flex-col gap-3 rounded-lg box-border px-6 pt-4 pb-5"
      style={{ backgroundColor: OVERLAY_COLORS.panel, boxShadow: "0 2px 10px rgba(0, 0, 0, 0.35)" }}
    >
      <div className="flex items-center gap-3">
        <KeySquare color={OVERLAY_COLORS.player1} />
        <span className="text-white text-2xl font-semibold">{player1Name}</span>
        <span className="text-white text-[32px] font-extrabold">{player1Percent}%</span>
        <GainLabel gain={gain} player={1} />
        <span
          className="flex-grow text-center text-[15px] font-bold uppercase tracking-[0.14em]"
          style={{ color: OVERLAY_COLORS.mutedText }}
        >
          Win chance{lowData && " · low data"}
        </span>
        <GainLabel gain={gain} player={2} />
        <span className="text-white text-[32px] font-extrabold">{100 - player1Percent}%</span>
        <span className="text-white text-2xl font-semibold">{player2Name}</span>
        <KeySquare color={OVERLAY_COLORS.player2} />
      </div>
      <div className="relative">
        <div className="flex h-[14px] w-full overflow-hidden rounded-full">
          <div
            className="transition-all duration-500"
            style={{ width: split, backgroundColor: OVERLAY_COLORS.player1 }}
          />
          <div className="flex-1" style={{ backgroundColor: OVERLAY_COLORS.player2 }} />
        </div>
        <div
          className="pointer-events-none absolute -top-1 -bottom-1 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)] transition-all duration-500"
          style={{ left: split, width: DIVIDER_WIDTH_PX }}
        />
      </div>
    </div>
  );
};

const KeySquare: React.FC<{ color: string }> = ({ color }) => (
  <span className="w-3.5 h-3.5 rounded-[3px] shrink-0" style={{ backgroundColor: color }} />
);

const GainLabel: React.FC<{ gain: PointGain | null; player: 1 | 2 }> = ({ gain, player }) =>
  gain?.player === player ? (
    <span className="text-lg font-bold" style={{ color: OVERLAY_COLORS.softText }}>
      ▲ {gain.points}
    </span>
  ) : null;

function stageScale(): number {
  return Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
}

function useStageScale(): number {
  const [scale, setScale] = useState(stageScale);
  useEffect(() => {
    const onResize = () => setScale(stageScale());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return scale;
}

/** True for `durationMs` after `count` goes up. The first value seen does not count as a change. */
function useShowAfterIncrease(count: number, durationMs: number): boolean {
  const [visible, setVisible] = useState(false);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = count;
    if (before === null) return;
    if (count < before) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(timer);
  }, [count, durationMs]);
  return visible;
}

/**
 * How much the last point raised the win chance of the player who won it. The
 * Monte-Carlo prediction has some noise, so a change against the point is not shown.
 */
function useLastPointGain(state: LiveGameState, player1WinChance: number): PointGain | null {
  const pointsPlayed =
    state.currentSet.player1 +
    state.currentSet.player2 +
    state.completedSets.reduce((sum, set) => sum + set.player1 + set.player2, 0);
  const lastSequence =
    state.currentSetSequence || state.completedSetSequences[state.completedSetSequences.length - 1] || "";
  const lastChar = lastSequence[lastSequence.length - 1];
  const lastPointWinner: 1 | 2 | null = lastChar === "1" ? 1 : lastChar === "2" ? 2 : null;

  const [gain, setGain] = useState<PointGain | null>(null);
  const previous = useRef<{ pointsPlayed: number; chance: number } | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = { pointsPlayed, chance: player1WinChance };
    if (!before || lastPointWinner === null || pointsPlayed !== before.pointsPlayed + 1) {
      setGain(null);
      return;
    }
    const change = Math.round((player1WinChance - before.chance) * 100) * (lastPointWinner === 1 ? 1 : -1);
    setGain(change > 0 ? { player: lastPointWinner, points: change } : null);
  }, [pointsPlayed, player1WinChance, lastPointWinner]);
  return gain;
}
