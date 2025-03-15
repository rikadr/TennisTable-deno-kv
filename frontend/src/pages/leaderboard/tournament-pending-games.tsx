import { Link } from "react-router-dom";
import { ProfilePicture } from "../player/profile-picture";
import { useClientDbContext } from "../../wrappers/client-db-context";
import { relativeTimeString } from "../../common/date-utils";

export const TournamentHighlightsAndPendingGames: React.FC = () => {
  const context = useClientDbContext();
  const tournaments = context.tournaments.getTournaments();

  const anyPendingGames = tournaments.some((tournament) => tournament.hasPendingGames);
  const anyRecentWinners = tournaments.some((tournament) => tournament.recentWinner);
  const anySignupPeriod = tournaments.some((tournament) => tournament.inSignupPeriod);
  if (!anyPendingGames && !anyRecentWinners && !anySignupPeriod) {
    return null;
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <h1 className="text-2xl text-center m2-4">Tournaments</h1>
      {tournaments.map(({ id, name, startDate, hasPendingGames, recentWinner, inSignupPeriod, groupPlay, bracket }) => {
        if (!hasPendingGames && !recentWinner && !inSignupPeriod) return null;
        return (
          <div key={id} className="space-y-1 p-2 ring-1 ring-secondary-background rounded-lg">
            <Link to={`/tournament?tournament=${id}`}>
              <button className="text-lg w-full py-1 px-2 rounded-md font-bold bg-secondary-background hover:bg-secondary-background/70 ">
                {name}
              </button>
            </Link>
            {inSignupPeriod && (
              <Link to={`/tournament?tournament=${id}`}>
                <p className="text-xs text-center italic mt-2">Start date:</p>
                <p className="text-sm text-center mb-2">
                  {relativeTimeString(new Date(startDate))} (
                  {new Intl.DateTimeFormat("en-US", {
                    minute: "numeric",
                    hour: "numeric",
                    hour12: false,
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(new Date(startDate))}
                  )
                </p>
                <div className="w-full text-center py-1">Sign up now! ✍️🏆</div>
              </Link>
            )}
            {recentWinner && <WinnerBox winner={recentWinner} />}
            {hasPendingGames && <h2>Pending games:</h2>}
            {hasPendingGames &&
              groupPlay &&
              // Group play games
              groupPlay.groups.map((group, groupIndex) => (
                <div key={groupIndex} className="space-y-1">
                  <h3 className="text-center text-sm">Group {groupIndex + 1}</h3>
                  {group.pending.map((game) => (
                    <PendingGame
                      key={game.player1! + game.player2!}
                      player1={game.player1!}
                      player2={game.player2!}
                      tournamentId={id}
                    />
                  ))}
                </div>
              ))}
            {hasPendingGames &&
              bracket &&
              // Bracket games
              bracket.bracketGames.map((layer, layerIndex) => (
                <div key={layerIndex} className="space-y-1">
                  {layerIndexToTournamentRound(layerIndex) && layer.pending.length > 0 && (
                    <h3 className="text-center text-sm">{layerIndexToTournamentRound(layerIndex)}</h3>
                  )}
                  {layer.pending.map((game) => (
                    <PendingGame
                      key={game.player1 + game.player2}
                      player1={game.player1}
                      player2={game.player2}
                      tournamentId={id}
                    />
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
  tournamentId: string;
};
export const PendingGame: React.FC<PendingGameProps> = ({ player1, player2, tournamentId }) => {
  return (
    <Link
      to={`/tournament?tournament=${tournamentId}&player1=${player1}&player2=${player2}`}
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
