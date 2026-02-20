import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";
import { WinnerBox } from "../leaderboard/tournament-pending-games";

export const TournamentsListPage: React.FC = () => {
  const { tournaments } = useEventDbContext();

  const sortedTournaments = tournaments.getTournaments().sort((a, b) => b.startDate - a.startDate);

  return (
    <div className="max-w-96 mx-4 md:mx-10 space-y-4 text-primary-text">
      <div className="flex items-center justify-between gap-4">
        <h1>Tournaments list</h1>
        <Link
          to="/tournament/new"
          className="whitespace-nowrap rounded-lg bg-secondary-background px-4 py-2 text-sm font-semibold text-secondary-text hover:opacity-80"
        >
          + New tournament
        </Link>
      </div>
      <div className="max-w-96 flex flex-col gap-2">
        {sortedTournaments.map((t) => (
          <Link key={t.id} to={`/tournament?tournament=${t.id}`} className="group">
            <div className="space-y-2 p-4 ring-1 ring-secondary-background rounded-lg group-hover:bg-secondary-background/30 bg-primary-background">
              <h2>{t.name}</h2>
              <p>{t.description}</p>
              <p className="text-xs text-center italic mt-2">Start date:</p>
              <p className="text-sm text-center mb-2">
                {relativeTimeString(new Date(t.startDate))} (
                {new Intl.DateTimeFormat("en-US", {
                  minute: "numeric",
                  hour: "numeric",
                  hour12: false,
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(t.startDate))}
                )
              </p>
              {t.inSignupPeriod && (
                <div className="bg-secondary-background text-secondary-text w-full text-center py-2 rounded-lg font-semibold">
                  Sign up now!
                </div>
              )}
              {t.winner && (
                <div className="min-w-80 max-w-96 space-y-2">
                  <p className="text-xs italic">Won {relativeTimeString(new Date(t.endDate || 0))}</p>
                  <WinnerBox winner={t.winner} />
                </div>
              )}
            </div>
          </Link>
        ))}
        {sortedTournaments.length === 0 && (
          <p>No tournaments has been played yet</p>
        )}
      </div>
    </div>
  );
};
