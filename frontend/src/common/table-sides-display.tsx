import React from "react";
import { classNames } from "./class-names";
import { fill } from "./player-color-styles";
import { BadSide } from "./table-sides";

type TableSideSelectorProps = {
  /** The player who has the bad side of the current set, if it is recorded. */
  badSide: BadSide;
  player1Name: string;
  player2Name: string;
  /** The players' own colours (`#rrggbb`), which the selected pill is tinted with. */
  player1Color: string;
  player2Color: string;
  onSelect: (badSide: BadSide) => void;
};

/**
 * Picks the player who has the bad side of the table in the current set. The
 * "Equal" option records that the 2 sides are equally good.
 *
 * A press on the selected option removes it again, so a set the operator does
 * not know goes back to no record. The selector stays available for the whole
 * set, because the players can change sides after the first point is scored.
 */
export const TableSideSelector: React.FC<TableSideSelectorProps> = ({
  badSide,
  player1Name,
  player2Name,
  player1Color,
  player2Color,
  onSelect,
}) => {
  const toggle = (option: BadSide) => onSelect(badSide === option ? null : option);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-xs text-gray-400">🚧 Bad side:</span>
      <button
        onClick={() => toggle(1)}
        title={`${player1Name} has the bad side of the table`}
        className={classNames(
          "text-xs px-2.5 py-1 rounded-full font-semibold transition",
          badSide === 1 ? "hover:brightness-95" : "bg-gray-100 text-gray-500 hover:bg-gray-200",
        )}
        style={badSide === 1 ? fill(player1Color) : undefined}
      >
        {player1Name}
      </button>
      <button
        onClick={() => toggle(2)}
        title={`${player2Name} has the bad side of the table`}
        className={classNames(
          "text-xs px-2.5 py-1 rounded-full font-semibold transition",
          badSide === 2 ? "hover:brightness-95" : "bg-gray-100 text-gray-500 hover:bg-gray-200",
        )}
        style={badSide === 2 ? fill(player2Color) : undefined}
      >
        {player2Name}
      </button>
      <button
        onClick={() => toggle("neutral")}
        title="Both sides of the table are equally good"
        className={classNames(
          "text-xs px-2.5 py-1 rounded-full font-semibold transition",
          badSide === "neutral"
            ? "bg-gray-700 text-white hover:brightness-125"
            : "bg-gray-100 text-gray-500 hover:bg-gray-200",
        )}
      >
        Equal
      </button>
    </div>
  );
};
