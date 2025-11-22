import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";

export function SeasonsListPage() {
  const context = useEventDbContext();
  const seasons = context.seasons.getSeasons();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Seasons</h1>
      <div className="flex flex-col space-y-2">
        {seasons.map(({ start }) => (
          <Link key={start} to={`/season?seasonStart=${start}`} className="p-4 border rounded-lg hover:bg-gray-100">
            <div className="font-semibold">
              {relativeTimeString(new Date(start))} - {dateString(start)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
