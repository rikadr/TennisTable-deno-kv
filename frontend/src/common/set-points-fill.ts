export type SetPointsSlot = "player1" | "player2";

/**
 * The points of one set as a form holds them. `autoFilled` names the slot the
 * form calculated from the other slot, so a later edit can update it.
 */
export type FillableSetPoints = { player1?: number; player2?: number; autoFilled?: SetPointsSlot };

/** The points of the set winner when the set loser got `loserPoints`: 11, or 2 more after 10-10. */
export function setWinnerPoints(loserPoints: number): number {
  return Math.max(11, loserPoints + 2);
}

/**
 * Sets the points of one slot. The players type the points of the set loser,
 * so the other slot gets the points of the set winner, while it is empty or
 * still holds a calculated value. A value the players typed stays as it is.
 */
export function updateSetPoints<T extends FillableSetPoints>(
  set: T,
  slot: SetPointsSlot,
  value: number | undefined,
): T {
  const other: SetPointsSlot = slot === "player1" ? "player2" : "player1";
  const otherIsFree = set[other] === undefined || set.autoFilled === other;

  if (otherIsFree === false) {
    return { ...set, [slot]: value, autoFilled: undefined };
  }
  if (value === undefined) {
    return { ...set, [slot]: undefined, [other]: undefined, autoFilled: undefined };
  }
  return { ...set, [slot]: value, [other]: setWinnerPoints(value), autoFilled: other };
}
