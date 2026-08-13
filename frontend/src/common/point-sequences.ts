/**
 * Point-by-point tracking during a live game.
 *
 * While a game is tracked the winner is unknown, so points are collected per
 * set as a string of "1"/"2" chars — one char per point, in the order the
 * points were scored, naming the player slot that won the point. When the game
 * is saved the sequences are re-encoded from the game winner's perspective
 * ("W"/"L") to match how a GAME_SCORE event stores its setPoints.
 */

export type TrackedSetPoints = { player1: number; player2: number };

export function appendPointToSequence(sequence: string, player: 1 | 2): string {
  return sequence + String(player);
}

/**
 * Undo one point for a player: drops that player's last point from the
 * sequence, keeping the points scored after it.
 */
export function removeLastPointFromSequence(sequence: string, player: 1 | 2): string {
  const index = sequence.lastIndexOf(String(player));
  if (index === -1) return sequence;
  return sequence.slice(0, index) + sequence.slice(index + 1);
}

function sequenceMatchesSet(sequence: string, set: TrackedSetPoints): boolean {
  const player1Points = sequence.split("").filter((point) => point === "1").length;
  const player2Points = sequence.length - player1Points;
  return player1Points === set.player1 && player2Points === set.player2;
}

/**
 * Re-encodes tracked "1"/"2" sequences to the "W"/"L" sequences stored on a
 * GAME_SCORE event. Returns undefined when the sequences do not align with the
 * completed sets — e.g. a live game that started before point tracking existed —
 * so the game is saved without point-level data instead of failing validation.
 */
export function toEventPointSequences(params: {
  setSequences: string[];
  completedSets: TrackedSetPoints[];
  player1IsGameWinner: boolean;
}): string[] | undefined {
  const { setSequences, completedSets, player1IsGameWinner } = params;
  if (completedSets.length === 0) return undefined;
  if (setSequences.length !== completedSets.length) return undefined;
  if (setSequences.some((sequence, index) => sequenceMatchesSet(sequence, completedSets[index]) === false)) {
    return undefined;
  }

  const gameWinnerDigit = player1IsGameWinner ? "1" : "2";
  return setSequences.map((sequence) =>
    sequence
      .split("")
      .map((point) => (point === gameWinnerDigit ? "W" : "L"))
      .join(""),
  );
}
