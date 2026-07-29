import React from "react";
import { useSearchParams } from "react-router-dom";
import { useLiveGameQuery } from "./use-live-game";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { getServeInfo } from "../../common/serve-tracker";
import { mixColors, readableTextColor } from "../../common/color-utils";
import { stringToColor } from "../../common/string-to-color";

const POLL_FALLBACK_MS = 1_000;
const CHROMA_GREEN = "#00b140";

const SCORE_WIDTH = 90;
const DIGIT_W = "w-[28px]";
const DASH_W = "w-[14px]";

export const LiveGameOverlay: React.FC = () => {
  const [searchParams] = useSearchParams();
  const zoom = parseFloat(searchParams.get("zoom") || "1") || 1;
  const context = useEventDbContext();
  const liveGameQuery = useLiveGameQuery({ refetchIntervalMs: POLL_FALLBACK_MS });

  const state = liveGameQuery.data;
  const isActive = !!state && !!state.player1Id && !!state.player2Id && state.startedAt !== null && !state.finishedAt;

  if (!isActive || !state) {
    return <div className="min-h-screen" style={{ backgroundColor: CHROMA_GREEN }} />;
  }

  const p1Name = context.playerName(state.player1Id);
  const p2Name = context.playerName(state.player2Id);
  const { server } = getServeInfo(state.currentSet, state.firstServer ?? 1);

  // The sets bar runs from one player's colour to the other's. Each digit sits near its own
  // end of the gradient, so its text colour is picked against the blend at that point rather
  // than against either end.
  const p1Color = stringToColor(state.player1Id!);
  const p2Color = stringToColor(state.player2Id!);
  const p1DigitColor = readableTextColor(mixColors(p1Color, p2Color, 0.2));
  const dashColor = readableTextColor(mixColors(p1Color, p2Color, 0.5));
  const p2DigitColor = readableTextColor(mixColors(p1Color, p2Color, 0.8));

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: CHROMA_GREEN, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
    >
      <div className="relative flex flex-col items-center gap-0" style={{ zoom }}>
        {/* Sets bar */}
        <div className="flex rounded-lg overflow-hidden ">
          <div className="bg-white text-gray-800 px-4 py-2 flex items-center min-w-[90px] gap-1">
            {server === 1 && <span className="text-sm">🏓</span>}
            <span className="text-sm font-semibold truncate">{p1Name}</span>
          </div>
          <div
            className="py-2 flex items-center justify-center"
            style={{
              background: `linear-gradient(to right, ${p1Color}, ${p2Color})`,
              width: `${SCORE_WIDTH}px`,
            }}
          >
            <span className={`text-2xl font-black ${DIGIT_W} text-right`} style={{ color: p1DigitColor }}>
              {state.setsWon.player1}
            </span>
            <span className={`text-sm font-bold opacity-70 ${DASH_W} text-center`} style={{ color: dashColor }}>
              -
            </span>
            <span className={`text-2xl font-black ${DIGIT_W} text-left`} style={{ color: p2DigitColor }}>
              {state.setsWon.player2}
            </span>
          </div>
          <div className="bg-white text-gray-800 px-4 py-2 flex items-center min-w-[90px] justify-end gap-1">
            <span className="text-sm font-semibold truncate">{p2Name}</span>
            {server === 2 && <span className="text-sm">🏓</span>}
          </div>
        </div>

        {/* Points bar — "Set N" label balanced by matching spacer on right */}
        <div className="flex rounded-b-lg overflow-hidden  mr-[64px]">
          <div className="bg-gray-200 text-gray-500 px-2 py-1 flex items-center w-16">
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
              Set {state.completedSets.length + 1}
            </span>
          </div>
          <div className="bg-gray-200 py-1 flex items-center justify-center pr-[10px]">
            <span className={`text-sm font-bold text-gray-800 ${DIGIT_W} text-right`}>{state.currentSet.player1}</span>
            <span className={`text-xs text-gray-400 ${DASH_W} text-center`}>-</span>
            <span className={`text-sm font-bold text-gray-800 ${DIGIT_W} text-left`}>{state.currentSet.player2}</span>
          </div>
          <div className="bg-gray-200 py-1" />
        </div>
      </div>
    </div>
  );
};
