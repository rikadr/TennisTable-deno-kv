import React from "react";
import { lighten, readableOn, readableTextColor } from "./color-utils";

/**
 * Shared styling for the scoring screens, which colour each side of the score with the player's
 * own colour. Player colours are generated from the player id and run from near-black to
 * near-white, so nothing here can assume a fixed text colour.
 */

/** The surfaces player colours are drawn on, so coloured text can be kept readable against them. */
export const CARD_SURFACE = "#ffffff";
export const ROW_SURFACE = "#f9fafb"; // bg-gray-50

/** How much white is mixed into a player colour for their side of the score display. */
const PANEL_TINT = 0.85;

/**
 * The contrast a chart mark must clear against its surface. Far below the 4.5:1
 * that text needs: a bar or a line is a shape, not something to read, so it
 * keeps the player's own colour. Only a near-white colour, which would be
 * invisible on a pale chart surface, moves at all.
 */
const MARK_MINIMUM_RATIO = 1.5;

/** How much white is mixed in for the secondary action next to a filled one. */
const SOFT_FILL_TINT = 0.35;

/** A surface filled with a player's colour, with the text colour that reads best on it. */
export function fill(color: string): React.CSSProperties {
  return { backgroundColor: color, color: readableTextColor(color) };
}

/** The same, but lightened - for the secondary action next to a filled one. */
export function softFill(color: string): React.CSSProperties {
  return fill(lighten(color, SOFT_FILL_TINT));
}

/** The pale wash behind a player's side of the current-set score. */
export function panelTint(color: string): string {
  return lighten(color, PANEL_TINT);
}

/** A player's colour as text on a surface, darkened where the raw colour is too pale to read. */
export function textOn(color: string, surface: string): React.CSSProperties {
  return { color: readableOn(color, surface) };
}

/**
 * A player's colour for a chart mark - a bar or a line - on a surface. Keeps the
 * raw colour, so a player is the same colour in a chart as everywhere else in
 * the app. Only a colour pale enough to disappear into the surface is darkened.
 */
export function markOn(color: string, surface: string): string {
  return readableOn(color, surface, MARK_MINIMUM_RATIO);
}
