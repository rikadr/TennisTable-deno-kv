import { Tournament } from "../../client/client-db/tournaments/tournament";
import { relativeTimeString } from "../../common/date-utils";
import { WinnerBox } from "../leaderboard/tournament-pending-games";

export const TournamentInfo = ({ tournament }: { tournament: Tournament }) => {
  return (
    <div className="ring-1 ring-secondary-background w-fit mx-4 px-4 md:mx-10 md:px-6 py-4 text-primary-text bg-primary-background rounded-lg">
      <p className="text-xs italic">Tournament:</p>
      <h1 className="mb-2">{tournament.name}</h1>
      <p className="text-xs italic">Description:</p>
      <p className="text-sm mb-2">{tournament.description || "-"}</p>
      <p className="text-xs italic">Start date:</p>
      <p className="text-sm mb-2">
        {relativeTimeString(new Date(tournament.startDate))} (
        {new Intl.DateTimeFormat("en-US", {
          minute: "numeric",
          hour: "numeric",
          hour12: false,
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(tournament.startDate))}
        )
      </p>
      {tournament.winner && (
        <div className="min-w-80 max-w-96 ">
          <p className="text-xs italic"> Won:</p>
          <p className="text-xs italic mb-2">
            {relativeTimeString(new Date(tournament.endDate || 0))} (
            {new Intl.DateTimeFormat("en-US", {
              minute: "numeric",
              hour: "numeric",
              hour12: false,
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date(tournament.endDate || 0))}
            )
          </p>
          <WinnerBox winner={tournament.winner} />
        </div>
      )}
    </div>
  );
};
