import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { layerIndexToTournamentRound } from "../leaderboard/tournament-pending-games";

function pendingGameRoundLabel(pendingGame: {
  layerIndex?: number;
  bracketSection?: "winners" | "losers" | "grandFinal" | "bracketReset";
}): string | undefined {
  switch (pendingGame.bracketSection) {
    case "losers":
      return "Losers bracket";
    case "grandFinal":
      return "Grand Final";
    case "bracketReset":
      return "The Final Decider";
    default:
      return pendingGame.layerIndex !== undefined ? layerIndexToTournamentRound(pendingGame.layerIndex) : undefined;
  }
}

export const PendingTournamentGame: React.FC<{ player1: string; player2: string }> = ({ player1, player2 }) => {
  const context = useEventDbContext();
  const pendingTournamentGames = context.tournaments.findAllPendingGames(player1, player2);

  if (pendingTournamentGames.length === 0) {
    return;
  }

  return (
    <div className="animate-wiggle">
      <p className="italic w-full text-center mb-2 text-primary-text">This game is pending in a tournament!</p>
      {pendingTournamentGames.map((pendingGame) => {
        const roundLabel = pendingGameRoundLabel(pendingGame);
        return (
          <Link
            key={pendingGame.tournament.id}
            to={`/tournament?tournament=${pendingGame.tournament.id}&player1=${pendingGame.player1}&player2=${pendingGame.player2}`}
          >
            <div className="ring-1 ring-secondary-background px-4 py-2 rounded-lg hover:bg-secondary-background/50 mb-2 text-primary-text">
              <h1>{pendingGame.tournament.name}</h1>
              {roundLabel && <p className="text-center text-lg">{roundLabel}</p>}
              {pendingGame.groupIndex !== undefined && (
                <p className="text-center text-lg">Group {pendingGame.groupIndex + 1}</p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
};
