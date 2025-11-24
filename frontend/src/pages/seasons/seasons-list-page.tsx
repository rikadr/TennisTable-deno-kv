import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";

export function SeasonsListPage() {
  const context = useEventDbContext();
  const seasons = context.seasons.getSeasons();

  return (
    <div className="p-4 text-primary-text bg-primary-background">
      <div className="mb-6 bg-yellow-950/80 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <h3 className="text-yellow-600 dark:text-yellow-500 font-semibold mb-1">Work in progress</h3>
            <p className="text-yellow-700 dark:text-yellow-400 text-sm">
              This feature is experimental and under construction. Have a look. Things will change
            </p>
          </div>
        </div>
      </div>
      <h1 className="text-2xl font-bold mb-4">Seasons</h1>
      <div className="flex flex-col space-y-2">
        {seasons.toReversed().map(({ start, end }, index) => (
          <Link
            key={start}
            to={`/season?seasonStart=${start}`}
            className="p-4 ring-1 ring-primary-text rounded-lg hover:bg-secondary-background hover:text-secondary-text transition-colors duration-100"
          >
            <div className="flex justify-between">
              <div className="font-semibold">
                Season {fmtNum(seasons.length - index)} - From {dateString(start)} to {dateString(end)}
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
              {Date.now() > end && <div>Ended 🏁</div>}
              {Date.now() < start && <div>Starts ⏳</div>}
              {Date.now() > start && Date.now() < end && <div>Active ✅</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
