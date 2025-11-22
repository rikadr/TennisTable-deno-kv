import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";

export function SeasonsListPage() {
  const context = useEventDbContext();
  const seasons = context.seasons.getSeasons();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Seasons</h1>
      <div className="flex flex-col space-y-2">
        {seasons.map(({ start, end }, index) => (
          <Link
            key={start}
            to={`/season?seasonStart=${start}`}
            className="p-4 border rounded-lg hover:bg-secondary-background hover:text-secondary-text"
          >
            <div className="font-semibold">
              Season {fmtNum(index + 1)} - From {dateString(start)} to {dateString(end)} -{" "}
              <p>
                {Date.now() > end && "Ended " + relativeTimeString(new Date(end)).toLowerCase()}
                {Date.now() > start &&
                  Date.now() < end &&
                  "Started " +
                    relativeTimeString(new Date(start)) +
                    ", ends " +
                    relativeTimeString(new Date(end)).toLowerCase()}
                {Date.now() < start && "Starts " + relativeTimeString(new Date(start)).toLowerCase()}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
