import { Link } from "react-router-dom";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";
import { TournamentGroupPlay } from "../../client/client-db/tournaments/group-play";
import { DashboardCard } from "./dashboard-card";
import { WinnerBox } from "../tournament/winner-box";
import { bracketLayerIndexToTournamentRound, secondChanceRoundLabel } from "../tournament/round-labels";

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
    <DashboardCard title="Tournaments" to="/tournament/list">
      <div className="flex flex-col gap-3 px-2 pb-2">
        {tournaments.map(
          ({ id, name, startDate, hasPendingGames, recentWinner, inSignupPeriod, groupPlay, bracket }) => {
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
                  // Bracket games (first chance bracket for double elimination)
                  bracket.bracketGames.map((layer, layerIndex) => (
                    <div key={layerIndex} className="space-y-1">
                      {bracketLayerIndexToTournamentRound(layerIndex, bracket.doubleElimination) &&
                        layer.pending.length > 0 && (
                          <h3 className="text-center text-sm text-primary-text">
                            {bracket.doubleElimination && "First Chance "}
                            {bracketLayerIndexToTournamentRound(layerIndex, bracket.doubleElimination)}
                          </h3>
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
                {hasPendingGames &&
                  bracket?.losersBracketGames &&
                  // Second chance bracket games (double elimination)
                  bracket.losersBracketGames.map((layer, layerIndex) => (
                    <div key={layerIndex} className="space-y-1">
                      {layer.pending.length > 0 && (
                        <h3 className="text-center text-sm text-primary-text">
                          {/* Title only: the subtitle explaining who enters is too long for this widget */}
                          {secondChanceRoundLabel(layerIndex, bracket.losersBracketGames!.length).title}
                        </h3>
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
                {hasPendingGames &&
                  bracket?.grandFinalGames &&
                  // Grand final and bracket reset games (double elimination)
                  bracket.grandFinalGames.pending.map((game) => (
                    <div key={game.player1 + game.player2} className="space-y-1">
                      <h3 className="text-center text-sm text-primary-text">
                        {game.section === "bracketReset" ? "The Final Decider" : "Final"}
                      </h3>
                      <PendingGame player1={game.player1} player2={game.player2} tournamentId={id} />
                    </div>
                  ))}
              </div>
            );
          },
        )}
      </div>
    </DashboardCard>
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
    const MAX_OVERLAP_OFFSET = 24; // Pictures overlap by 11px (35 - 24)
    // From 7 opponents, the pictures move closer so the row is never wider than 6 pictures at the max offset
    const MAX_VISIBLE_AT_MAX_OFFSET = 6;
    const maxWidth = (MAX_VISIBLE_AT_MAX_OFFSET - 1) * MAX_OVERLAP_OFFSET + PICTURE_SIZE;
    const OVERLAP_OFFSET =
      opponentsArray.length > MAX_VISIBLE_AT_MAX_OFFSET
        ? (maxWidth - PICTURE_SIZE) / (opponentsArray.length - 1)
        : MAX_OVERLAP_OFFSET;

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
        className="w-full px-2 xs:px-4 py-2 rounded-lg grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 h-12 bg-secondary-background hover:bg-secondary-background/70 text-secondary-text"
      >
        <div className="flex gap-2 xs:gap-3 items-center min-w-0">
          <ProfilePicture playerId={playerId} size={35} shape="circle" border={3} />
          <h3 className="truncate">{context.playerName(playerId)}</h3>
        </div>
        <h2 className="mb-0 font-bold text-lg">VS</h2>
        <div className="flex justify-end min-w-0">
          <OverlappingProfilePictures opponents={opponents} />
        </div>
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
      className="w-full px-2 xs:px-4 py-2 rounded-lg grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 h-12 bg-secondary-background hover:bg-secondary-background/70 text-secondary-text"
    >
      <div className="flex gap-2 xs:gap-3 items-center min-w-0">
        <ProfilePicture playerId={player1} size={35} shape="circle" border={3} />
        <h3 className="truncate">{context.playerName(player1)}</h3>
      </div>
      <h2 className="mb-0">VS</h2>
      <div className="flex gap-2 xs:gap-3 items-center justify-end min-w-0">
        <h3 className="truncate">{context.playerName(player2)}</h3>
        <ProfilePicture playerId={player2} size={35} shape="circle" border={3} />
      </div>
    </Link>
  );
};
