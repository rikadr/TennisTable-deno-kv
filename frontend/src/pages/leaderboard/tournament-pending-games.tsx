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

    const anyRecentWinners = context.tournaments
      .getTournaments()
      .some(
        (tournament) => tournament.startDate < new Date().getTime() && tournament.bracket[0][0].winner !== undefined,
      );

    if (!anyPendingGames && !anyRecentWinners) {
      return null;
    }
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <h1 className="text-2xl text-center m2-4">Tournaments</h1>
      <p>
        Hi! <br />
        Im testing the upcoming tournament features. <br />
        If you have feedback or wished, please share your thoughts with me 😄 <br />- Rikard
      </p>
      {context.tournaments.getTournaments().map((tournament) => {
        const anyPendingGames =
          tournament.startDate < new Date().getTime() && tournament.games.some((layer) => layer.pending.length > 0);

        const recentWinner =
          tournament.startDate < new Date().getTime() &&
          tournament.bracket[0][0].winner !== undefined &&
          tournament.bracket[0][0].winner;

        if (!anyPendingGames && !recentWinner) return null;

        return (
          <div key={tournament.id} className="space-y-1 p-2 ring-1 ring-secondary-background rounded-lg">
            <Link to={`/tournament?tournament=${tournament.id}`}>
              <button className="text-lg w-full py-1 px-2 rounded-md font-bold bg-secondary-background hover:bg-secondary-background/70 ">
                {tournament.name}
              </button>
            </Link>
            {recentWinner && <WinnerBox winner={recentWinner} />}
            {anyPendingGames && <p className="text-base font-thin">Pending games:</p>}
            {anyPendingGames &&
              tournament.games.map((layer, layerIndex) => (
                <div key={layerIndex} className="space-y-1">
                  {layerIndexToTournamentRound(layerIndex) && layer.pending.length > 0 && (
                    <h3 className="text-center text-sm">{layerIndexToTournamentRound(layerIndex)}</h3>
                  )}
                  {layer.pending.map((game) => (
                    <PendingGame key={game.player1 + game.player2} player1={game.player1} player2={game.player2} />
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
export const PendingGame: React.FC<PendingGameProps> = ({ player1, player2 }) => {
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
    case 5:
      return "32nd Finals";
    case 6:
      return "64th Finals";
    case 7:
      return "128th Finals";
    case 8:
      return "256th Finals";
  }
}
