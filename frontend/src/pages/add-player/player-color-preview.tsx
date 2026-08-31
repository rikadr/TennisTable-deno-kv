import { classNames } from "../../common/class-names";
import { stringToColor } from "../../common/string-to-color";

/**
 * The player's color as it looks on a profile picture, before the player
 * exists. The color comes from the player id, so the preview takes the id.
 * Without an id it shows an empty place for the color the user must select.
 */
export const PlayerColorPreview: React.FC<{ playerId?: string; playerName: string; size?: number }> = ({
  playerId,
  playerName,
  size = 96,
}) => (
  <div
    className={classNames(
      "flex items-center justify-center rounded-full shadow-md shrink-0 font-bold select-none",
      playerId ? "ring-4 ring-white/80 text-white" : "border-4 border-dashed border-primary-text/40",
      !playerId && "text-primary-text/40",
    )}
    style={{
      background: playerId ? stringToColor(playerId) : "transparent",
      height: size,
      width: size,
      fontSize: size * 0.6,
    }}
  >
    {playerName.trim()[0] ?? "?"}
  </div>
);
