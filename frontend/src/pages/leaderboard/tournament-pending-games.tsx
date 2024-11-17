import { Link } from "react-router-dom";
import { ProfilePicture } from "../player/profile-picture";
import { useClientDbContext } from "../../wrappers/client-db-context";

export const TournamentHighlightsAndPendingGames: React.FC = () => {
  const context = useClientDbContext();

  {
    const anyPendingGames = context.tournaments
      .getTournaments()
      .some(
        (tournament) =>
          tournament.startDate < new Date().getTime() && tournament.games.some((layer) => layer.pending.length > 0),
      );

    const anyRecentWinners = context.tournaments.getTournaments().some(
      (tournament) =>
        tournament.startDate < new Date().getTime() &&
        tournament.bracket[0][0].winner !== undefined &&
        tournament.bracket[0][0].completedAt !== undefined &&
        tournament.bracket[0][0].completedAt > new Date().getTime() - 7 * 24 * 60 * 60 * 1000, // Max 7 days old
    );

    if (!anyPendingGames && !anyRecentWinners) {
      return null;
    }
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <h1 className="text-2xl text-center m2-4">Tournaments</h1>
      {context.tournaments.getTournaments().map((tournament) => {
        const anyPendingGames =
          tournament.startDate < new Date().getTime() && tournament.games.some((layer) => layer.pending.length > 0);

        const recentWinner =
          tournament.startDate < new Date().getTime() &&
          tournament.bracket[0][0].winner !== undefined &&
          tournament.bracket[0][0].completedAt !== undefined &&
          // Max 7 days old
          tournament.bracket[0][0].completedAt > new Date().getTime() - 7 * 24 * 60 * 60 * 1000 &&
          tournament.bracket[0][0].winner;

        if (!anyPendingGames && !recentWinner) return null;

        return (
          <div key={tournament.id} className="space-y-1">
            <Link to="/tournament" className="text-lg font-bold">
              {tournament.name}
            </Link>
            {recentWinner && <WinnerBox winner={recentWinner} />}
            {anyPendingGames &&
              tournament.games.map((layer, layerIndex) => (
                <div key={layerIndex} className="space-y-1">
                  {layerIndexToTournamentRound(layerIndex) && layer.pending.length > 0 && (
                    <h3 className="text-center text-sm">{layerIndexToTournamentRound(layerIndex)}</h3>
                  )}
                  {layer.pending.map((game) => (
                    <PendingGames key={game.player1 + game.player2} player1={game.player1} player2={game.player2} />
                  ))}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
};

type PendingGameProps = {
  player1: string;
  player2: string;
};
const PendingGames: React.FC<PendingGameProps> = ({ player1, player2 }) => {
  return (
    <Link
      // to={`/1v1/?player1=${player1}&player2=${player2}`}
      to={`/add-game/?player1=${player1}&player2=${player2}`}
      className="relative w-full px-4 py-2 rounded-lg flex items-center gap-x-4 h-12 bg-secondary-background hover:bg-secondary-background/70"
    >
      <h2 className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">VS</h2>
      <div className="flex gap-3 items-center justify-center">
        <ProfilePicture name={player1} size={35} shape="circle" clickToEdit={false} border={3} />
        <h3 className="truncate">{player1}</h3>
      </div>
      <div className="grow" />
      <div className="flex gap-3 items-center justify-center">
        <h3 className="truncate">{player2}</h3>
        <ProfilePicture name={player2} size={35} shape="circle" clickToEdit={false} border={3} />
      </div>
    </Link>
  );
};

type WinnerBoxProps = {
  winner: string;
};
export const WinnerBox: React.FC<WinnerBoxProps> = ({ winner }) => {
  return (
    <Link
      to={`/player/${winner}`}
      className="w-full px-4 py-2 rounded-lg flex items-center gap-x-4 h-16 bg-secondary-background hover:bg-secondary-background/70"
    >
      <div className="flex gap-3 items-center justify-center">
        <ProfilePicture name={winner} size={50} shape="circle" clickToEdit={false} border={3} />
        <div className="-space-y-1">
          <div className="text-sm">Winner</div>
          <h3 className="text-2xl font-bold uppercase">{winner}</h3>
        </div>
      </div>
      <div className="grow" />
      <div className="text-4xl">🏆🥇</div>
    </Link>
  );
};

export function layerIndexToTournamentRound(index: number): string | undefined {
  switch (index) {
    case 0:
      return "Final";
    case 1:
      return "Semi Finals";
    case 2:
      return "Quarter Finals";
    case 3:
      return "8th Finals";
    case 4:
      return "16th Finals";
  }
}
