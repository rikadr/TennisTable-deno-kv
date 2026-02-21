import { Link } from "react-router-dom";
import { Tournament } from "../../client/client-db/tournaments/tournament";
import { relativeTimeString } from "../../common/date-utils";
import { session } from "../../services/auth";
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
  const startDate = new Date(tournament.startDate);
  const endDate = tournament.endDate ? new Date(tournament.endDate) : null;
  const hasGroupPlay = tournament.tournamentDb.groupPlay;
  const isAdmin = session.sessionData?.role === "admin";

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
      </div>
    </div>
  );
};
