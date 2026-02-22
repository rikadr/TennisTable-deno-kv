import { Link } from "react-router-dom";
import { Tournament } from "../../client/client-db/tournaments/tournament";
import { TournamentGroupPlay } from "../../client/client-db/tournaments/group-play";
import { relativeTimeString } from "../../common/date-utils";
import { session } from "../../services/auth";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { WinnerBox } from "../leaderboard/tournament-pending-games";

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("en-US", {
    minute: "numeric",
    hour: "numeric",
    hour12: false,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mb-4">
    <p className="text-xs font-medium text-primary-text/70 uppercase tracking-wide mb-1">{label}</p>
    <div className="text-sm">{children}</div>
  </div>
);

export const TournamentInfo = ({ tournament }: { tournament: Tournament }) => {
  const context = useEventDbContext();
  const startDate = new Date(tournament.startDate);
  const endDate = tournament.endDate ? new Date(tournament.endDate) : null;
  const hasGroupPlay = tournament.tournamentConfig.groupPlay;
  const isAdmin = session.sessionData?.role === "admin";
  const hasStarted = tournament.startDate <= Date.now();

  return (
    <div className="ring-1 ring-secondary-background w-full max-w-2xl mx-auto px-4 md:px-6 py-6 text-primary-text bg-primary-background rounded-lg shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{tournament.name}</h1>
          {tournament.description && (
            <p className="text-sm text-primary-text/80 leading-relaxed">{tournament.description}</p>
          )}
        </div>
        {isAdmin && (
          <Link
            to={`/tournament/edit?tournament=${tournament.id}`}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary-background text-secondary-text hover:opacity-80"
          >
            Edit
          </Link>
        )}
      </div>

      <div className="space-y-4">
        <InfoRow label="Start Date">
          <p className="font-medium">{relativeTimeString(startDate)}</p>
          <p className="text-xs text-primary-text/70 mt-1">{formatDate(startDate)}</p>
        </InfoRow>

        {tournament.winner && endDate && (
          <InfoRow label="Tournament Ended">
            <p className="font-medium mb-3">{relativeTimeString(endDate)}</p>
            <p className="text-xs text-primary-text/70 mb-3">{formatDate(endDate)}</p>
            <div className="pt-2 border-t border-secondary-background">
              <p className="text-xs font-medium text-primary-text/70 uppercase tracking-wide mb-2">Winner</p>
              <WinnerBox winner={tournament.winner} />
            </div>
          </InfoRow>
        )}

        <InfoRow label="Format">
          <div className="flex items-center gap-2">
            {hasGroupPlay && (
              <>
                <span className="px-2 py-1 rounded text-xs font-medium bg-secondary-background text-secondary-text">
                  Group Play
                </span>{" "}
                {"->"}
              </>
            )}
            <span className="px-2 py-1 rounded text-xs font-medium bg-secondary-background text-secondary-text">
              Direct Elimination
            </span>
          </div>
        </InfoRow>

        {hasStarted && (
          <div className="flex gap-6">
            {hasGroupPlay && tournament.groupPlay && (
              <SeedingCard
                label="Group seeding order & group play tie-breaker"
                players={tournament.groupPlay.playerOrder}
                playerName={context.playerName.bind(context)}
              />
            )}
            <DirectEliminationSeedingCard tournament={tournament} playerName={context.playerName.bind(context)} />
          </div>
        )}
      </div>
    </div>
  );
};

const SeedingCard = ({
  label,
  sublabel,
  players,
  playerName,
  eliminationZone,
}: {
  label: string;
  sublabel?: string;
  players: string[];
  playerName: (id: string) => string;
  eliminationZone?: number;
}) => (
  <div>
    <p className="text-xs font-medium text-primary-text/70 uppercase tracking-wide mb-1">{label}</p>
    {sublabel && <p className="text-xs text-primary-text/50 mb-2">{sublabel}</p>}
    <ol className="list-none space-y-1">
      {players.map((playerId, index) => (
        <li
          key={playerId}
          className={`flex items-center gap-2 text-sm px-2 rounded ${eliminationZone !== undefined && index >= eliminationZone
            ? "text-primary-text/40 line-through"
            : ""
            }`}
        >
          <span className="text-xs text-primary-text/50 w-5 text-right">{index + 1}.</span>
          <span>{playerName(playerId)}</span>
        </li>
      ))}
    </ol>
  </div>
);

const DirectEliminationSeedingCard = ({
  tournament,
  playerName,
}: {
  tournament: Tournament;
  playerName: (id: string) => string;
}) => {
  const hasGroupPlay = tournament.tournamentConfig.groupPlay;
  const groupPlayOngoing = tournament.groupPlay && tournament.groupPlay.groupPlayEnded === undefined;

  if (hasGroupPlay && groupPlayOngoing) {
    // Provisional seeding based on current group scores
    const bracketSize = tournament.groupPlay!.getBracketSize();
    const allSorted = Array.from(tournament.groupPlay!.groupScores)
      .sort(TournamentGroupPlay.sortGroupScores)
      .map(([playerId]) => playerId);

    return (
      <SeedingCard
        label="Direct elimination seeding order (provisional)"
        sublabel="Based on current group play standings. Players below the line are eliminated."
        players={allSorted}
        playerName={playerName}
        eliminationZone={bracketSize}
      />
    );
  }

  // Bracket exists — show actual seeding
  if (!tournament.bracket) return null;

  let players: string[];
  if (hasGroupPlay && tournament.groupPlay?.groupPlayEnded !== undefined) {
    players = tournament.groupPlay.getBracketPlayerOrder() ?? [];
  } else {
    players = tournament.tournamentConfig.playerOrder ?? tournament.signedUp.map((s) => s.player);
  }

  return (
    <SeedingCard
      label="Direct elimination seeding order"
      players={players}
      playerName={playerName}
    />
  );
};
