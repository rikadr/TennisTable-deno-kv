import { Link } from "react-router-dom";
import { useClientDbContext } from "../../wrappers/client-db-context";
import { relativeTimeString } from "../../common/date-utils";

export const TournamentsListPage: React.FC = () => {
  const {
    client: { tournaments },
  } = useClientDbContext();

  const sortedTournaments = [...tournaments].sort((a, b) => b.startDate - a.startDate);

  return (
    <div className="max-w-96 mx-4 md:mx-10 space-y-4">
      <h1>Tournaments list</h1>
      <div className="max-w-96 flex flex-col gap-2">
        {sortedTournaments.map((t) => (
          <Link key={t.id} to={`/tournament?tournament=${t.id}`} className="group">
            <div className="space-y-1 p-2 ring-1 ring-secondary-background rounded-lg group-hover:bg-secondary-background/50">
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
            </div>
          </Link>
        ))}
        {sortedTournaments.length === 0 && (
          <p>No tournaments. Want to set up a tournament? Reach out to Rikard to set up a new tournament 🏆</p>
        )}
      </div>
    </div>
  );
};
