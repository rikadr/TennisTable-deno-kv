import React from "react";
import { classNames } from "../../common/class-names";
import { LiveGameSetPoint } from "./live-game-types";

export const CompletedSetsList: React.FC<{ sets: LiveGameSetPoint[] }> = ({ sets }) => {
  if (sets.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 text-black">
      <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">
        Completed Sets
      </h3>
      <div className="space-y-2">
        {sets.map((set, index) => {
          const setWinner = set.player1 > set.player2 ? 1 : 2;
          return (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
            >
              <span className="font-semibold text-gray-700">Set {index + 1}</span>
              <div className="flex items-center gap-3">
                <div className="w-5 text-right">{setWinner === 1 && "🏆"}</div>
                <div className="w-16 flex items-center justify-between text-lg">
                  <span
                    className={classNames(
                      "font-bold",
                      setWinner === 1 ? "text-blue-600" : "text-gray-400",
                    )}
                  >
                    {set.player1}
                  </span>
                  <span className="text-gray-400">-</span>
                  <span
                    className={classNames(
                      "font-bold",
                      setWinner === 2 ? "text-purple-600" : "text-gray-400",
                    )}
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
