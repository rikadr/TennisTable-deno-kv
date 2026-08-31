import { classNames } from "../../common/class-names";
import { stringToColor } from "../../common/string-to-color";
import { PlayerColorPreview } from "./player-color-preview";

export const StepPlayerColor: React.FC<{
  playerName: string;
  playerId: string;
  colorOptions: string[];
  selectColor: (id: string) => void;
  understandsPermanent: boolean;
  setUnderstandsPermanent: (value: boolean) => void;
}> = ({ playerName, playerId, colorOptions, selectColor, understandsPermanent, setUnderstandsPermanent }) => (
  <div className="space-y-5 max-w-md mx-auto">
    <div className="text-center space-y-1">
      <h2 className="text-xl font-bold text-primary-text">Select the color of {playerName}</h2>
    </div>

    {/* The permanence of the choice, before the choice itself. */}
    <div className="rounded-lg border-2 border-red-500 bg-white text-black px-4 py-3 space-y-1">
      <p className="font-bold text-red-700">⚠️ The color is permanent</p>
      <p className="text-sm">
        You select the color of a player 1 time. After you create the player, you cannot change the color.
      </p>
    </div>

    <div
      className="w-full text-center flex items-center justify-center flex-col p-4 rounded-lg shadow-md"
      style={{ background: stringToColor(playerId) }}
    >
      <PlayerColorPreview playerId={playerId} playerName={playerName} size={96} />
      <span className="font-semibold text-white bg-black/40 rounded-full px-3 py-1 mt-3">
        The color of {playerName}
      </span>
    </div>

    <div className="space-y-2">
      <p className="text-sm text-center text-primary-text">Select a color to use it. The 8 colors change each time.</p>
      <div className="grid grid-cols-4 gap-2">
        {colorOptions.map((optionId) => (
          <button
            key={optionId}
            type="button"
            className="aspect-square rounded-lg text-black/80 text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50"
            style={{ background: stringToColor(optionId) }}
            onClick={() => selectColor(optionId)}
            aria-label="Select this color"
          >
            Select
          </button>
        ))}
      </div>
    </div>

    <button
      type="button"
      className={classNames(
        "w-full flex items-center gap-3 text-left px-4 py-3 rounded-lg transition-colors",
        "bg-secondary-background text-secondary-text hover:bg-secondary-background/70",
        understandsPermanent && "ring-2 ring-primary-text",
      )}
      aria-pressed={understandsPermanent}
      onClick={() => setUnderstandsPermanent(!understandsPermanent)}
    >
      <span
        className={classNames(
          "flex items-center justify-center size-6 shrink-0 rounded border-2 border-current text-sm font-bold",
          understandsPermanent ? "bg-primary-background text-primary-text" : "bg-transparent",
        )}
      >
        {understandsPermanent ? "✓" : ""}
      </span>
      <span className="text-sm font-medium">I understand that the color of {playerName} is permanent.</span>
    </button>
  </div>
);
