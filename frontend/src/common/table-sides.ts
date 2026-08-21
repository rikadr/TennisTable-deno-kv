/**
 * Which side of the table the players had in each set of a game.
 *
 * One side of a table is often worse than the other, because of the light, the
 * space behind it or a draught. The players usually change sides after every
 * set, but not every pair does it. While a game is tracked or entered the side
 * is kept as the player slot that has the bad side. When the game is saved each
 * set's side is re-encoded from the game winner's perspective, the same way the
 * point sequences are, onto the set's `setPoints` entry.
 */

import { Server } from "./serve-tracker";

/**
 * The player slot that had the bad side of the table in one set: 1 or 2 for
 * that player, "neutral" when the 2 sides are equally good, and null when
 * nobody recorded the sides.
 */
export type BadSide = 1 | 2 | "neutral" | null;

/**
 * The side the game winner had in one set, as the `gameWinnerSide` of a
 * `setPoints` entry of a GAME_SCORE event: "G" = the good side, "B" = the bad
 * side, "N" = the 2 sides are equally good.
 */
export type WinnerSide = "G" | "B" | "N";

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
 * Encodes the bad side of one set from the game winner's perspective, or
 * undefined when the set has no recorded side. Each set is on its own, so the
 * players can record the sides they remember and leave the rest out.
 */
export function gameWinnerSideOfBadSide(badSide: BadSide, gameWinnerSlot: Server): WinnerSide | undefined {
  if (badSide === null) return undefined;
  if (badSide === "neutral") return "N";
  return badSide === gameWinnerSlot ? "B" : "G";
}

/** The inverse of `gameWinnerSideOfBadSide`: the player slot that had the bad side. */
export function badSideOfGameWinnerSide(side: WinnerSide | undefined, gameWinnerSlot: Server): BadSide {
  if (side === undefined) return null;
  if (side === "N") return "neutral";
  const gameLoserSlot: Server = gameWinnerSlot === 1 ? 2 : 1;
  return side === "B" ? gameWinnerSlot : gameLoserSlot;
}

/**
 * A label for one tracked set: who has the bad side, or that the sides are
 * equally good. Null when the set has no recorded side — including a set past
 * the end of a side list, which a game tracked before the sides existed has.
 */
export function badSideLabel(
  badSide: BadSide | undefined,
  player1Name: string,
  player2Name: string,
): string | null {
  if (badSide === 1) return `${player1Name} on the bad side`;
  if (badSide === 2) return `${player2Name} on the bad side`;
  if (badSide === "neutral") return "Equal sides";
  return null;
}

/**
 * The sides of `setCount` completed sets, with a null for every set that has
 * none. A game that was tracked before the sides existed has fewer sides than
 * sets, and padding keeps every later side with its own set.
 */
export function alignBadSides(badSides: BadSide[], setCount: number): BadSide[] {
  return Array.from({ length: setCount }, (_, index) => badSides[index] ?? null);
}

/** The name of the player who had the bad side, or "Equal" for a neutral set. */
export function badSideName(side: WinnerSide, gameWinnerName: string, gameLoserName: string): string {
  if (side === "N") return "Equal";
  return side === "B" ? gameWinnerName : gameLoserName;
}
