import { classNames } from "../../common/class-names";
import { fill } from "../../common/player-color-styles";
import { stringToColor } from "../../common/string-to-color";
import { PlayerColorPreview } from "./player-color-preview";

export const StepPlayerColor: React.FC<{
  playerName: string;
  /** The selected color, as the id it comes from. Undefined until the user selects 1. */
  playerId?: string;
  colorOptions: string[];
  selectColor: (id: string) => void;
  showOtherColors: () => void;
}> = ({ playerName, playerId, colorOptions, selectColor, showOtherColors }) => (
  <div className="space-y-4 max-w-md mx-auto">
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

    {/* 1 bar of the same size in both states: the colors stay on the screen of
        a phone, and a selection moves nothing under the finger of the user. */}
    <div
      className={classNames(
        "w-full flex items-center gap-4 p-3 rounded-lg",
        playerId ? "shadow-md" : "border-2 border-dashed border-primary-text/40",
      )}
      style={playerId ? { background: stringToColor(playerId) } : undefined}
    >
      <PlayerColorPreview playerId={playerId} playerName={playerName} size={56} />
      {playerId ? (
        <span className="font-semibold text-white bg-black/40 rounded-full px-3 py-1">The color of {playerName}</span>
      ) : (
        <span className="font-semibold text-primary-text">No color selected</span>
      )}
    </div>

    <div className="space-y-3">
      <p className="text-sm text-center text-primary-text">
        {playerId ? "Select an other color to change it." : "Select 1 of the 8 colors to continue."}
      </p>
      {/* The inset keeps the ring of the selected color inside the screen. */}
      <div className="grid grid-cols-4 gap-2 px-2">
        {colorOptions.map((optionId) => {
          const color = stringToColor(optionId);
          const isSelected = optionId === playerId;

          return (
            <button
              key={optionId}
              type="button"
              aria-pressed={isSelected}
              aria-label={isSelected ? "The selected color" : "Select this color"}
              className={classNames(
                "aspect-[4/3] rounded-lg text-sm font-semibold transition-all shadow-md",
                "hover:scale-105 active:scale-95 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50",
                // The offset separates the ring from the color, so it is
                // visible on a pale color and on a dark color.
                isSelected && "ring-4 ring-primary-text ring-offset-2 ring-offset-primary-background",
              )}
              style={fill(color)}
              onClick={() => selectColor(optionId)}
            >
              {isSelected ? "✓ Selected" : "Select"}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-primary-text bg-secondary-background hover:bg-secondary-background/70 transition-colors"
        onClick={showOtherColors}
      >
        🔄 Show 8 other colors
      </button>
    </div>
  </div>
);
