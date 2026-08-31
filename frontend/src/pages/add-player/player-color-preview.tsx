import { classNames } from "../../common/class-names";
import { stringToColor } from "../../common/string-to-color";

/**
 * The player's color as it looks on a profile picture, before the player
 * exists. The color comes from the player id, so the preview takes the id.
 */
export const PlayerColorPreview: React.FC<{ playerId: string; playerName: string; size?: number }> = ({
  playerId,
  playerName,
  size = 96,
}) => (
  <div
    className={classNames(
      "flex items-center justify-center rounded-full ring-4 ring-white/80 shadow-md shrink-0",
      "font-bold text-white select-none",
    )}
    style={{
      background: stringToColor(playerId),
      height: size,
      width: size,
      fontSize: size * 0.6,
    }}
  >
    {playerName.trim()[0] ?? "?"}
  </div>
);
