import React, { useEffect, useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { Predictions } from "../../client/client-db/predictions";
import { fmtNum } from "../../common/number-utils";
import { stringToColor } from "../../common/string-to-color";

type Props = {
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
};

export const LiveGamePredictionCard: React.FC<Props> = ({ player1Id, player2Id, player1Name, player2Name }) => {
  const context = useEventDbContext();

  // Mirror the player-page predictions tab: when at least one player is unranked
  // the prediction is gated behind a warning the user must acknowledge before it
  // is shown. Reset the acknowledgement whenever the matchup changes.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setRevealed(false);
  }, [player1Id, player2Id]);

  const player1Ranked = context.leaderboard.getPlayerSummary(player1Id)?.isRanked ?? false;
  const player2Ranked = context.leaderboard.getPlayerSummary(player2Id)?.isRanked ?? false;
  const bothUnranked = !player1Ranked && !player2Ranked;
  const hasUnranked = !player1Ranked || !player2Ranked;

  const predictions = context.predictions;
  const direct = predictions.getDirectFraction(player1Id, player2Id);
  const oneLayer = predictions.getOneLayerFraction(player1Id, player2Id);
  const twoLayer = predictions.getTwoLayerFraction(player1Id, player2Id);
  const combined = Predictions.combinePrioritizedFractions([direct, oneLayer, twoLayer]);

  const confidence = combined?.confidence ?? 0;
  const player1WinChance = combined?.fraction ?? 0;
  const player2WinChance = 1 - player1WinChance;
  const hasPrediction = confidence > 0;

  const unrankedLabel = bothUnranked ? "Both players are not ranked" : "One player is not ranked";

  // Unranked gate — acknowledge the warning before revealing the prediction.
  if (hasUnranked && !revealed) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-4 text-black text-center">
        <h2 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Win Prediction</h2>
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
    <div className="bg-white rounded-xl shadow-lg p-4 text-black">
      <h2 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3 text-center">Win Prediction</h2>

      {hasUnranked && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-yellow-500/60 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          <span className="text-base leading-none">⚠️</span>
          <span>{unrankedLabel} — the prediction is based on insufficient data and may be unreliable.</span>
        </div>
      )}

      {hasPrediction ? (
        <>
          <div className="flex items-baseline justify-between text-sm font-semibold mb-1">
            <span className="truncate max-w-[45%]" style={{ color: stringToColor(player1Id) }}>
              {player1Name}
            </span>
            <span className="truncate max-w-[45%] text-right" style={{ color: stringToColor(player2Id) }}>
              {player2Name}
            </span>
          </div>
          <div className="flex h-8 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="flex items-center justify-start bg-blue-500 px-2 text-xs font-bold text-white transition-all"
              style={{ width: `${player1WinChance * 100}%` }}
            >
              {player1WinChance >= 0.12 && `${fmtNum(player1WinChance * 100)}%`}
            </div>
            <div
              className="flex items-center justify-end bg-purple-500 px-2 text-xs font-bold text-white transition-all"
              style={{ width: `${player2WinChance * 100}%` }}
            >
              {player2WinChance >= 0.12 && `${fmtNum(player2WinChance * 100)}%`}
            </div>
          </div>
          <div className="mt-1 flex justify-between text-xs font-semibold">
            <span className="text-blue-600">{fmtNum(player1WinChance * 100)}% win chance</span>
            <span className="text-purple-600">{fmtNum(player2WinChance * 100)}% win chance</span>
          </div>
          <div className="mt-3 text-center text-xs text-gray-500">{fmtNum(confidence * 100)}% confidence</div>
        </>
      ) : (
        <p className="text-center text-sm text-gray-500 py-2">Not enough data to predict a winner yet.</p>
      )}
    </div>
  );
};
