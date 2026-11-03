import React, { useEffect, useState } from "react";
import { CARD_SURFACE, fill, textOn } from "../../common/player-color-styles";
import { fmtNum } from "../../common/number-utils";
import { stringToColor } from "../../common/string-to-color";
import { LiveGameSetPoint } from "./live-game-types";
import { useLiveWinPrediction } from "./use-live-win-prediction";

/** Width of the white pill that marks the split in the win prediction bar. */
const DIVIDER_WIDTH_PX = 6;

type Props = {
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  setsWon: { player1: number; player2: number };
  currentSet: LiveGameSetPoint;
  completedSets: LiveGameSetPoint[];
  bestOf: number;
};

export const LiveGamePredictionCard: React.FC<Props> = ({
  player1Id,
  player2Id,
  player1Name,
  player2Name,
  setsWon,
  currentSet,
  completedSets,
  bestOf,
}) => {
  const player1Color = stringToColor(player1Id);
  const player2Color = stringToColor(player2Id);

  // Mirror the player-page predictions tab: when at least one player is unranked
  // the prediction is gated behind a warning the user must acknowledge before it
  // is shown. Reset the acknowledgement whenever the matchup changes.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setRevealed(false);
  }, [player1Id, player2Id]);

  const { player1WinChance, confidence, hasPrediction, hasUnranked, bothUnranked } = useLiveWinPrediction({
    player1Id,
    player2Id,
    setsWon,
    currentSet,
    completedSets,
    bestOf,
  });
  const player2WinChance = 1 - player1WinChance;

  // The win chance splits the full width of the bar. The divider width is taken off the
  // span, so at 0% and 100% the divider sits flush with the end of the bar and stays in view.
  const split = `calc(${DIVIDER_WIDTH_PX / 2}px + ${player1WinChance} * (100% - ${DIVIDER_WIDTH_PX}px))`;

  const unrankedLabel = bothUnranked ? "Both players are not ranked" : "One player is not ranked";

  // Unranked gate — acknowledge the warning before revealing the prediction.
  if (hasUnranked && !revealed) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-4 text-black text-center">
        <h2 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Live Win Prediction</h2>
        <div className="text-3xl mb-2">⚠️</div>
        <p className="text-base font-semibold mb-1">{unrankedLabel}</p>
        <p className="text-sm text-gray-500 mb-4">
          The prediction is based on insufficient data and may be unreliable.
        </p>
        <button
          onClick={() => setRevealed(true)}
          className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Show prediction anyway
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 text-black">
      <h2 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-2 text-center">
        Live Win Prediction
      </h2>

      {hasPrediction ? (
        <>
          {/* Each player's win chance sits in the label row, so the bar itself
              needs no text and can stay short. */}
          <div className="flex items-baseline justify-between gap-2 text-sm font-semibold mb-1">
            <span className="truncate" style={textOn(player1Color, CARD_SURFACE)}>
              {player1Name} {fmtNum(player1WinChance * 100)}%
            </span>
            <span className="truncate text-right" style={textOn(player2Color, CARD_SURFACE)}>
              {fmtNum(player2WinChance * 100)}% {player2Name}
            </span>
          </div>
          <div className="relative">
            <div className="flex h-6 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="transition-all duration-500" style={{ width: split, ...fill(player1Color) }} />
              <div className="flex-1" style={fill(player2Color)} />
            </div>
            {/* Two similar player colours can hide the split, so a white pill marks it.
                The shadow keeps the pill visible when a player colour is near white. */}
            <div
              className="pointer-events-none absolute -top-1 -bottom-1 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)] transition-all duration-500"
              style={{ left: split, width: DIVIDER_WIDTH_PX }}
            />
          </div>
          <div className="mt-1 text-center text-xs text-gray-500">{fmtNum(confidence * 100)}% confidence</div>
        </>
      ) : (
        <p className="text-center text-sm text-gray-500 py-2">Not enough data to predict a winner yet.</p>
      )}

      {hasUnranked && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-yellow-500/60 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          <span className="text-base leading-none">⚠️</span>
          <span>{unrankedLabel} — the prediction is based on insufficient data and may be unreliable.</span>
        </div>
      )}
    </div>
  );
};
