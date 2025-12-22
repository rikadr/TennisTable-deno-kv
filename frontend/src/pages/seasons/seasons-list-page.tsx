import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";
import { ProfilePicture } from "../player/profile-picture";

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
        {seasons.toReversed().map((season, index) => {
          const { start, end } = season;
          const hasEnded = Date.now() > end;
          let winnerId: string | undefined;

          if (hasEnded) {
            const leaderboard = season.getLeaderboard();
            if (leaderboard.length > 0) {
              winnerId = leaderboard[0].playerId;
            }
          }

          return (
            <Link
              key={start}
              to={`/season?seasonStart=${start}`}
              className="p-4 ring-1 ring-primary-text rounded-lg hover:bg-secondary-background hover:text-secondary-text transition-colors duration-100"
            >
              <div className="flex justify-between items-center">
                <div className="font-semibold">
                  <div>
                    Season {fmtNum(seasons.length - index)} - From {dateString(start)} to {dateString(end)}
                  </div>
                  <div className="text-sm font-normal mt-1">
                    {hasEnded && "Ended " + relativeTimeString(new Date(end)).toLowerCase()}
                    {Date.now() > start &&
                      !hasEnded &&
                      "Started " +
                        relativeTimeString(new Date(start)) +
                        ", ends " +
                        relativeTimeString(new Date(end)).toLowerCase()}
                    {Date.now() < start && "Starts " + relativeTimeString(new Date(start)).toLowerCase()}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {winnerId && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
                      <span className="text-yellow-600 dark:text-yellow-400 font-medium text-sm">Winner</span>
                      <ProfilePicture playerId={winnerId} size={24} border={1} />
                      <span className="font-bold text-sm">{context.playerName(winnerId)}</span>
                    </div>
                  )}

                  <div className="text-sm font-medium opacity-80 min-w-[80px] text-right">
                    {hasEnded && <div>Ended 🏁</div>}
                    {Date.now() < start && <div>Starts ⏳</div>}
                    {!hasEnded && Date.now() > start && <div>Active ✅</div>}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
