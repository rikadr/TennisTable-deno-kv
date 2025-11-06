import { useEventDbContext } from "../../wrappers/event-db-context";

type Props = {
  playerId?: string;
};

export const PlayerTrophies: React.FC<Props> = ({ playerId }) => {
  const context = useEventDbContext();
  context.playerTrophies.calculateTrophies();

  return <div>Trophies tab {playerId}</div>;
};
