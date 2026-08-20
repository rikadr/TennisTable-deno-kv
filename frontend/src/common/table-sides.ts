/**
 * Which side of the table the players had in each set of a tracked game.
 *
 * One side of a table is often worse than the other, because of the light, the
 * space behind it or a draught. The players usually change sides after every
 * set, but not every pair does it. While a game is tracked the side is kept as
 * the player slot that has the bad side. When the game is saved it is
 * re-encoded from the game winner's perspective, the same way the point
 * sequences are.
 */

import { Server } from "./serve-tracker";

/**
 * The player slot that had the bad side of the table in one set: 1 or 2 for
 * that player, "neutral" when the 2 sides are equally good, and null when
 * nobody recorded the sides.
 */
export type BadSide = 1 | 2 | "neutral" | null;

/**
 * The side the game winner had in one set, as one char of the `winnerSides`
 * string of a GAME_SCORE event: "G" = the good side, "B" = the bad side,
 * "N" = the 2 sides are equally good.
 */
export type WinnerSide = "G" | "B" | "N";

/** Every char a stored `winnerSides` string can hold. */
export const WINNER_SIDES_PATTERN = /^[GBN]*$/;

/**
 * The bad side of the next set. The players change sides after every set, so
 * the bad side moves to the other player. A neutral or unrecorded set keeps its
 * value, because there is nothing to change.
 */
export function nextSetBadSide(badSide: BadSide): BadSide {
  if (badSide === 1) return 2;
  if (badSide === 2) return 1;
  return badSide;
}

/**
 * Encodes the bad side of every set from the game winner's perspective. Returns
 * undefined when a set has no recorded side, so the game keeps the rest of its
 * tracking data instead of storing a side nobody recorded.
 */
export function encodeWinnerSides(badSides: BadSide[], gameWinnerSlot: Server): string | undefined {
  if (badSides.length === 0) return undefined;
  if (badSides.some((side) => side === null)) return undefined;
  return badSides.map((side) => (side === "neutral" ? "N" : side === gameWinnerSlot ? "B" : "G")).join("");
}

/** The side the game winner had in one set, or undefined when it is not recorded. */
export function winnerSideOfSet(winnerSides: string | undefined, setIndex: number): WinnerSide | undefined {
  const side = winnerSides?.[setIndex];
  return side === "G" || side === "B" || side === "N" ? side : undefined;
}

/**
 * A label for one tracked set: who has the bad side, or that the sides are
 * equally good. Null when the set has no recorded side.
 */
export function badSideLabel(badSide: BadSide, player1Name: string, player2Name: string): string | null {
  if (badSide === null) return null;
  if (badSide === "neutral") return "Equal sides";
  return `${badSide === 1 ? player1Name : player2Name} on the bad side`;
}

/** The name of the player who had the bad side, or "Equal" for a neutral set. */
export function badSideName(side: WinnerSide, gameWinnerName: string, gameLoserName: string): string {
  if (side === "N") return "Equal";
  return side === "B" ? gameWinnerName : gameLoserName;
}
