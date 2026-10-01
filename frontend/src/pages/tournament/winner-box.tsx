import { Link } from "react-router-dom";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";

type WinnerBoxProps = {
  winner: string;
};
export const WinnerBox: React.FC<WinnerBoxProps> = ({ winner }) => {
  const context = useEventDbContext();
  return (
    <Link
      to={`/player/${winner}`}
      className="w-full px-4 py-2 rounded-lg flex items-center gap-x-4 h-16 bg-secondary-background text-secondary-text hover:bg-secondary-background/70"
    >
      <div className="flex gap-3 items-center justify-center">
        <ProfilePicture playerId={winner} size={50} shape="circle" border={3} />
        <div className="-space-y-1">
          <div className="text-sm">Winner</div>
          <h3 className="text-2xl font-bold uppercase">{context.playerName(winner)}</h3>
        </div>
      </div>
      <div className="grow" />
      <div className="text-4xl">🏆🥇</div>
    </Link>
  );
};
