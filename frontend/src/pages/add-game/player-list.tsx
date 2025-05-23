import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";

export const PlayerList: React.FC<{ playerIds: string[]; onSelect: (playerId: string) => void }> = ({
  playerIds,
  onSelect,
}) => {
  const context = useEventDbContext();

  return (
    <div>
      {playerIds.map((playerId) => (
        <button
          key={playerId}
          onClick={() => onSelect(playerId)}
          className="w-full px-2 py-1 bg-primary-background text-primary-text transition-all duration-200 hover:bg-secondary-background hover:text-secondary-text"
        >
          <div className="flex items-center space-x-3">
            <ProfilePicture playerId={playerId} border={3} size={32} />
            <h3>{context.playerName(playerId)}</h3>
          </div>
        </button>
      ))}
    </div>
  );
};
