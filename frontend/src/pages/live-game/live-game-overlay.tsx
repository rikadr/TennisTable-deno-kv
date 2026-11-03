import React from "react";
import { useSearchParams } from "react-router-dom";
import { useLiveGameQuery } from "./use-live-game";
import { LiveGameSetPoint } from "./live-game-types";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { getServeInfo } from "../../common/serve-tracker";

const POLL_FALLBACK_MS = 1_000;
const CHROMA_GREEN = "#00b140";

// Fixed colours, not player colours: a green player colour is keyed out with the chroma green.
const PANEL = "#10213f";
const ACCENT = "#ffcc00";
const DIVIDER = "rgba(255, 255, 255, 0.16)";
const MUTED = "#8e9bb8";
const CURRENT_DIVIDER = "#d4d4d8";

const ROW_HEIGHT = 44;
const CELL_WIDTH = 44;

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

const winnerCell: React.CSSProperties = { backgroundColor: ACCENT, color: "#111111", fontWeight: 800 };
const loserCell: React.CSSProperties = { color: MUTED, fontWeight: 600 };
const currentCell: React.CSSProperties = { color: "#000000", fontWeight: 800 };

export const LiveGameOverlay: React.FC = () => {
  const [searchParams] = useSearchParams();
  const zoom = parseFloat(searchParams.get("zoom") || "1") || 1;
  const context = useEventDbContext();
  // The overlay is captured on a screen next to the table, where the tab counts
  // as a background tab. It must keep the poll running.
  const liveGameQuery = useLiveGameQuery({ refetchIntervalMs: POLL_FALLBACK_MS, refetchInBackground: true });

  const state = liveGameQuery.data;
  const isActive = !!state && !!state.player1Id && !!state.player2Id && state.startedAt !== null && !state.finishedAt;

  if (!isActive || !state) {
    return <div className="min-h-screen" style={{ backgroundColor: CHROMA_GREEN }} />;
  }

  const { server } = getServeInfo(state.currentSet, state.firstServer ?? 1);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: CHROMA_GREEN, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
    >
      <div
        className="inline-flex rounded-md overflow-hidden"
        style={{ zoom, fontVariantNumeric: "tabular-nums", boxShadow: "0 2px 10px rgba(0, 0, 0, 0.35)" }}
      >
        <div className="flex flex-col" style={{ backgroundColor: PANEL }}>
          <NameRow name={context.playerName(state.player1Id)} serving={server === 1} divider />
          <NameRow name={context.playerName(state.player2Id)} serving={server === 2} />
        </div>
        {state.completedSets.map((set, index) => (
          <CompletedSetColumn key={index} set={set} />
        ))}
        <div className="flex flex-col" style={{ backgroundColor: "#ffffff" }}>
          <div style={{ ...cellStyle, ...currentCell, borderBottom: `1px solid ${CURRENT_DIVIDER}` }}>
            {state.currentSet.player1}
          </div>
          <div style={{ ...cellStyle, ...currentCell }}>{state.currentSet.player2}</div>
        </div>
      </div>
    </div>
  );
};

const NameRow: React.FC<{ name: string; serving: boolean; divider?: boolean }> = ({ name, serving, divider }) => (
  <div
    className="flex items-center gap-2.5 pl-3 pr-[18px]"
    style={{ height: ROW_HEIGHT, boxSizing: "border-box", borderBottom: divider ? `1px solid ${DIVIDER}` : undefined }}
  >
    <span
      className="rounded-full shrink-0"
      style={{ width: 10, height: 10, backgroundColor: serving ? ACCENT : "transparent" }}
    />
    <span className="text-white text-xl font-semibold whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px]">
      {name}
    </span>
  </div>
);

const CompletedSetColumn: React.FC<{ set: LiveGameSetPoint }> = ({ set }) => {
  const player1Won = set.player1 > set.player2;
  return (
    <div className="flex flex-col" style={{ backgroundColor: PANEL, borderLeft: `1px solid ${DIVIDER}` }}>
      <div style={{ ...cellStyle, ...(player1Won ? winnerCell : loserCell), borderBottom: `1px solid ${DIVIDER}` }}>
        {set.player1}
      </div>
      <div style={{ ...cellStyle, ...(player1Won ? loserCell : winnerCell) }}>{set.player2}</div>
    </div>
  );
};
