import React from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";

/** The clickable row of the leaderboard-shaped dashboard tables */
export const DASHBOARD_ROW_CLASS_NAME =
  "bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-sm xs:text-lg md:text-xl font-light";

/** A flexible cell with the player's picture and a truncated name */
export const PlayerNameCell: React.FC<{ playerId: string }> = ({ playerId }) => {
  const context = useEventDbContext();
  return (
    <td className="py-1 px-1 xs:px-2 w-full max-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <ProfilePicture playerId={playerId} size={28} border={2} />
        <span className="font-normal truncate">{context.playerName(playerId)}</span>
      </div>
    </td>
  );
};
