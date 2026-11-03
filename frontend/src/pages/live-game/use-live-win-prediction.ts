import { useMemo } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { LiveGameSetPoint } from "./live-game-types";
import { computeLiveWinPrediction } from "./live-game-win-probability";

export type LiveWinPredictionResult = {
  player1WinChance: number;
  confidence: number;
  /** False when there is no pairing data and no point is played yet. */
  hasPrediction: boolean;
  hasUnranked: boolean;
  bothUnranked: boolean;
  /** Player 1's pre-game chance to win: the pairing prediction, or 0.5 without one. */
  preGameWinChance: number;
  preGameConfidence: number;
};

export function useLiveWinPrediction(params: {
  player1Id: string;
  player2Id: string;
  setsWon: { player1: number; player2: number };
  currentSet: LiveGameSetPoint;
  completedSets: LiveGameSetPoint[];
  bestOf: number;
}): LiveWinPredictionResult {
  const { player1Id, player2Id, setsWon, currentSet, completedSets, bestOf } = params;
  const context = useEventDbContext();

  const player1Ranked = context.leaderboard.getPlayerSummary(player1Id)?.isRanked ?? false;
  const player2Ranked = context.leaderboard.getPlayerSummary(player2Id)?.isRanked ?? false;

  // Static pre-game pairing prediction (same math as the player-page tab).
  const base = context.predictions.getPredictedFraction(player1Id, player2Id);
  const baseConfidence = base?.confidence ?? 0;
  const baseFraction = base?.fraction ?? 0;
  const hasBasePrediction = baseConfidence > 0;
  const preGameWinChance = hasBasePrediction ? baseFraction : 0.5;

  const pointsPlayed =
    currentSet.player1 + currentSet.player2 + completedSets.reduce((sum, set) => sum + set.player1 + set.player2, 0);

  // Primitives + a serialized key so the memo depends only on stable values
  // (the score objects get new identities on every poll/render).
  const setsWonP1 = setsWon.player1;
  const setsWonP2 = setsWon.player2;
  const currentSetP1 = currentSet.player1;
  const currentSetP2 = currentSet.player2;
  const completedSetsKey = JSON.stringify(completedSets);

  // Live prediction: derive a per-point win chance from the pre-game prediction
  // plus the points/sets played so far, then Monte-Carlo simulate the rest of
  // the match from the current score (see live-game-win-probability). Memoised
  // so the simulation only re-runs when the score actually changes.
  const { player1WinChance, confidence } = useMemo(
    () =>
      computeLiveWinPrediction({
        preGameWinChance,
        preGameConfidence: baseConfidence,
        setsWon: { player1: setsWonP1, player2: setsWonP2 },
        currentSet: { player1: currentSetP1, player2: currentSetP2 },
        completedSets: JSON.parse(completedSetsKey) as LiveGameSetPoint[],
        bestOf,
      }),
    [preGameWinChance, baseConfidence, setsWonP1, setsWonP2, currentSetP1, currentSetP2, completedSetsKey, bestOf],
  );

  return {
    player1WinChance,
    confidence,
    hasPrediction: hasBasePrediction || pointsPlayed > 0,
    hasUnranked: !player1Ranked || !player2Ranked,
    bothUnranked: !player1Ranked && !player2Ranked,
    preGameWinChance,
    preGameConfidence: baseConfidence,
  };
}
