import React from "react";
import { classNames } from "./class-names";
import { fill } from "./player-color-styles";
import { getServeInfo, Server } from "./serve-tracker";

type ServeTrackerProps = {
  currentSet: { player1: number; player2: number };
  firstServer: Server;
  player1Name: string;
  player2Name: string;
  /** The players' own colours (`#rrggbb`), which the tracker is tinted with. */
  player1Color: string;
  player2Color: string;
  /**
   * When provided, a "Starts serving" selector is shown while the current set
   * is still 0-0, letting the operator pick who serves first. Omit for
   * read-only displays (e.g. the public scoreboard / TV overlay).
   */
  onSelectFirstServer?: (player: Server) => void;
};

export const ServeTrackerDisplay: React.FC<ServeTrackerProps> = ({
  currentSet,
  firstServer,
  player1Name,
  player2Name,
  player1Color,
  player2Color,
  onSelectFirstServer,
}) => {
  const { server, servesRemaining, isDeuce } = getServeInfo(currentSet, firstServer);
  const serverName = server === 1 ? player1Name : player2Name;
  const isSetEmpty = currentSet.player1 === 0 && currentSet.player2 === 0;
  const serverColor = server === 1 ? player1Color : player2Color;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold" style={fill(serverColor)}>
        <span>🏓</span>
        <span>{serverName} to serve</span>
        {isDeuce ? (
          <span className="text-xs font-normal opacity-80">(deuce)</span>
        ) : (
          <span className="text-xs font-normal opacity-80">
            ({servesRemaining} serve{servesRemaining === 1 ? "" : "s"} left)
          </span>
        )}
      </div>

      {onSelectFirstServer && isSetEmpty && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">Starts serving:</span>
          <button
            onClick={() => onSelectFirstServer(1)}
            className={classNames(
              "text-xs px-2 py-0.5 rounded-full font-semibold transition",
              firstServer === 1 ? "hover:brightness-95" : "bg-gray-100 text-gray-500 hover:bg-gray-200",
            )}
            style={firstServer === 1 ? fill(player1Color) : undefined}
          >
            {player1Name}
          </button>
          <button
            onClick={() => onSelectFirstServer(2)}
            className={classNames(
              "text-xs px-2 py-0.5 rounded-full font-semibold transition",
              firstServer === 2 ? "hover:brightness-95" : "bg-gray-100 text-gray-500 hover:bg-gray-200",
            )}
            style={firstServer === 2 ? fill(player2Color) : undefined}
          >
            {player2Name}
          </button>
        </div>
      )}
    </div>
  );
};
