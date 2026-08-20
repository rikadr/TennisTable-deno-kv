import React from "react";
import { classNames } from "../../common/class-names";
import { ROW_SURFACE, textOn } from "../../common/player-color-styles";
import { BadSide, badSideLabel } from "../../common/table-sides";
import { LiveGameSetPoint } from "./live-game-types";

type Props = {
  sets: LiveGameSetPoint[];
  /** Who had the bad side of the table in each set, parallel to `sets`. */
  badSides: BadSide[];
  player1Name: string;
  player2Name: string;
  /** The players' own colours (`#rrggbb`), used to mark who won each set. */
  player1Color: string;
  player2Color: string;
};

export const CompletedSetsList: React.FC<Props> = ({
  sets,
  badSides,
  player1Name,
  player2Name,
  player1Color,
  player2Color,
}) => {
  if (sets.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 text-black">
      <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-2">Completed Sets</h3>
      <div className="space-y-2">
        {sets.map((set, index) => {
          const setWinner = set.player1 > set.player2 ? 1 : 2;
          const sideLabel = badSideLabel(badSides[index], player1Name, player2Name);
          return (
            <div key={index} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
              <div className="flex flex-col">
                <span className="font-semibold text-gray-700">Set {index + 1}</span>
                {sideLabel && <span className="text-xs text-gray-400">🚧 {sideLabel}</span>}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 text-right">{setWinner === 1 && "🏆"}</div>
                <div className="w-16 flex items-center justify-between text-lg">
                  <span
                    className={classNames("font-bold", setWinner !== 1 && "text-gray-400")}
                    style={setWinner === 1 ? textOn(player1Color, ROW_SURFACE) : undefined}
                  >
                    {set.player1}
                  </span>
                  <span className="text-gray-400">-</span>
                  <span
                    className={classNames("font-bold", setWinner !== 2 && "text-gray-400")}
                    style={setWinner === 2 ? textOn(player2Color, ROW_SURFACE) : undefined}
                  >
                    {set.player2}
                  </span>
                </div>
                <div className="w-5">{setWinner === 2 && "🏆"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
