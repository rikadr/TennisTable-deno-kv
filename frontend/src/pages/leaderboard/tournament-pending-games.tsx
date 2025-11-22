import { Link } from "react-router-dom";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";
import { TournamentGroupPlay } from "../../client/client-db/tournaments/group-play";

export const TournamentHighlightsAndPendingGames: React.FC = () => {
  const context = useEventDbContext();
  const tournaments = context.tournaments.getTournaments();

  const anyPendingGames = tournaments.some((tournament) => tournament.hasPendingGames);
  const anyRecentWinners = tournaments.some((tournament) => tournament.recentWinner);
  const anySignupPeriod = tournaments.some((tournament) => tournament.inSignupPeriod);
  if (!anyPendingGames && !anyRecentWinners && !anySignupPeriod) {
    return null;
  }

  return (
    <div className="w-full flex flex-col gap-4 bg-primary-background rounded-lg">
      <h1 className="text-2xl text-center text-primary-text m2-4">Tournaments</h1>
      {tournaments.map(({ id, name, startDate, hasPendingGames, recentWinner, inSignupPeriod, groupPlay, bracket }) => {
        if (!hasPendingGames && !recentWinner && !inSignupPeriod) return null;
        return (
          <div key={id} className="space-y-1 p-2 ring-1 ring-secondary-background rounded-lg">
            <Link to={`/tournament?tournament=${id}`}>
              <button className="text-lg text-secondary-text w-full py-1 px-2 rounded-md font-bold bg-secondary-background hover:bg-secondary-background/70 ">
                {name}
              </button>
            </Link>
            {inSignupPeriod && (
              <Link to={`/tournament?tournament=${id}`} className="text-primary-text">
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
            {hasPendingGames &&
              groupPlay &&
              // Group play games
              groupPlay.groups.map(
                (group, groupIndex) =>
                  group.pending.length > 0 && (
                    <div key={groupIndex} className="space-y-1">
                      <h3 className="text-center text-sm text-primary-text">Group {groupIndex + 1}</h3>
                      <PendingGameGroup group={group} groupIndex={groupIndex} tournamentId={id} />
                    </div>
                  ),
              )}
            {hasPendingGames &&
              bracket &&
              // Bracket games
              bracket.bracketGames.map((layer, layerIndex) => (
                <div key={layerIndex} className="space-y-1">
                  {layerIndexToTournamentRound(layerIndex) && layer.pending.length > 0 && (
                    <h3 className="text-center text-sm text-primary-text">{layerIndexToTournamentRound(layerIndex)}</h3>
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

type PendingGameGroupProps = {
  group: (typeof TournamentGroupPlay.prototype.groups)[number];
  groupIndex: number;
  tournamentId: string;
};

const PendingGameGroup: React.FC<PendingGameGroupProps> = ({ group, groupIndex, tournamentId }) => {
  const context = useEventDbContext();

  if (group.pending.length === 0) {
    return null;
  }

  const pendingMap = new Map<string, Set<string>>();
  group.pending.forEach((p) => {
    if (pendingMap.has(p.player1!) === false) {
      pendingMap.set(p.player1!, new Set());
    }
    if (pendingMap.has(p.player2!) === false) {
      pendingMap.set(p.player2!, new Set());
    }
    pendingMap.get(p.player1!)?.add(p.player2!);
    pendingMap.get(p.player2!)?.add(p.player1!);
  });

  // Component for rendering overlapping profile pictures
  const OverlappingProfilePictures: React.FC<{ opponents: Set<string> }> = ({ opponents }) => {
    const opponentsArray = Array.from(opponents);
    const PICTURE_SIZE = 35;
    const OVERLAP_OFFSET = 24; // Fixed spacing - pictures overlap by 11px (35 - 24)

    // Calculate total width needed: last picture position + picture size
    const totalWidth = opponentsArray.length > 0 ? (opponentsArray.length - 1) * OVERLAP_OFFSET + PICTURE_SIZE : 0;

    return (
      <div
        className="relative"
        style={{
          width: `${totalWidth}px`,
          height: `${PICTURE_SIZE}px`,
        }}
      >
        {opponentsArray.toReversed().map((opponent, index) => (
          <div
            key={opponent}
            className="absolute"
            style={{
              left: `${(opponentsArray.length - index - 1) * OVERLAP_OFFSET}px`,
            }}
          >
            <ProfilePicture playerId={opponent} size={PICTURE_SIZE} shape="circle" border={3} />
          </div>
        ))}
      </div>
    );
  };

  return Array.from(pendingMap).map(([playerId, opponents]) => {
    return (
      <Link
        key={playerId}
        to={`/player/${playerId}`}
        className="relative w-full px-4 py-2 rounded-lg flex items-center gap-x-4 h-12 bg-secondary-background hover:bg-secondary-background/70 text-secondary-text"
      >
        <h2 className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 font-bold text-lg">VS</h2>
        <div className="flex gap-3 items-center justify-center">
          <ProfilePicture playerId={playerId} size={35} shape="circle" border={3} />
          <h3 className="truncate">{context.playerName(playerId)}</h3>
        </div>
        <div className="grow" />
        <OverlappingProfilePictures opponents={opponents} />
      </Link>
    );
  });
};

type PendingGameProps = {
  player1: string;
  player2: string;
  tournamentId: string;
};
const PendingGame: React.FC<PendingGameProps> = ({ player1, player2, tournamentId }) => {
  const context = useEventDbContext();
  return (
    <Link
      to={`/tournament?tournament=${tournamentId}&player1=${player1}&player2=${player2}`}
      className="relative w-full px-4 py-2 rounded-lg flex items-center gap-x-4 h-12 bg-secondary-background hover:bg-secondary-background/70 text-secondary-text"
    >
      <h2 className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">VS</h2>
      <div className="flex gap-3 items-center justify-center">
        <ProfilePicture playerId={player1} size={35} shape="circle" border={3} />
        <h3 className="truncate">{context.playerName(player1)}</h3>
      </div>
      <div className="grow" />
      <div className="flex gap-3 items-center justify-center">
        <h3 className="truncate">{context.playerName(player2)}</h3>
        <ProfilePicture playerId={player2} size={35} shape="circle" border={3} />
      </div>
    </Link>
  );
};

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
