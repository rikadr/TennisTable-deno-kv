import React from "react";
import { classNames } from "./class-names";
import { fill } from "./player-color-styles";
import { BadSide, badSideLabel } from "./table-sides";

const PILL = "text-xs px-2.5 py-1 rounded-full font-semibold transition";
const UNSELECTED_PILL = "bg-gray-100 text-gray-500 hover:bg-gray-200";

type TableSideDisplayProps = {
  currentSet: { player1: number; player2: number };
  /** The player who has the bad side of the current set, if it is recorded. */
  badSide: BadSide;
  player1Name: string;
  player2Name: string;
  /** The players' own colours (`#rrggbb`), which the tracker is tinted with. */
  player1Color: string;
  player2Color: string;
  /**
   * When provided, the players are selectable while the current set is still
   * 0-0, letting the operator pick who has the bad side. Omit for read-only
   * displays (e.g. the public scoreboard).
   */
  onSelect?: (badSide: BadSide) => void;
};

/**
 * Which side of the table the players have in the current set. "Equal" records
 * that the 2 sides are equally good, and it sits between the 2 players, the
 * same way the sides of the table do.
 *
 * The side locks when the first point of the set is scored, the same as the
 * first server, because the players keep their side for the whole set. While
 * the set is 0-0 a press on the selected option removes it again, so a set the
 * operator does not know goes back to no record.
 */
export const TableSideDisplay: React.FC<TableSideDisplayProps> = ({
  currentSet,
  badSide,
  player1Name,
  player2Name,
  player1Color,
  player2Color,
  onSelect,
}) => {
  const isSetEmpty = currentSet.player1 === 0 && currentSet.player2 === 0;
  const label = badSideLabel(badSide, player1Name, player2Name);

  if (onSelect && isSetEmpty) {
    const toggle = (option: BadSide) => onSelect(badSide === option ? null : option);
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-gray-400">🚧 Bad side:</span>
        <button
          onClick={() => toggle(1)}
          title={`${player1Name} has the bad side of the table`}
          className={classNames(PILL, badSide === 1 ? "hover:brightness-95" : UNSELECTED_PILL)}
          style={badSide === 1 ? fill(player1Color) : undefined}
        >
          {player1Name}
        </button>
        <button
          onClick={() => toggle("neutral")}
          title="Both sides of the table are equally good"
          className={classNames(
            PILL,
            badSide === "neutral" ? "bg-gray-700 text-white hover:brightness-125" : UNSELECTED_PILL,
          )}
        >
          Equal
        </button>
        <button
          onClick={() => toggle(2)}
          title={`${player2Name} has the bad side of the table`}
          className={classNames(PILL, badSide === 2 ? "hover:brightness-95" : UNSELECTED_PILL)}
          style={badSide === 2 ? fill(player2Color) : undefined}
        >
          {player2Name}
        </button>
      </div>
    );
  }

  // The set is locked. Show the side it was given, or say that it has none.
  if (label === null) {
    return <div className="text-center text-xs text-gray-400">🚧 No bad side recorded for this set</div>;
  }

  return (
    <div className="flex items-center justify-center">
      <div
        className={classNames(PILL, badSide === "neutral" && "bg-gray-700 text-white")}
        style={badSide === "neutral" ? undefined : fill(badSide === 1 ? player1Color : player2Color)}
      >
        🚧 {label}
      </div>
    </div>
  );
};
