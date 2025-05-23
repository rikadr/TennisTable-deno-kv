import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";

export const SelectedPlayerCard: React.FC<{
  playerId: string;
  onClear: () => void;
}> = ({ playerId, onClear }) => {
  const context = useEventDbContext();

  return (
    <div className="bg-primary-background text-primary-text border-2 border-secondary-background rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ProfilePicture playerId={playerId} border={4} size={48} />
          <h3 className="font-semibold text-xl">{context.playerName(playerId)}</h3>
        </div>
        <button
          onClick={onClear}
          className="px-3 py-1 bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/50 rounded-lg text-sm font-medium transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
};
