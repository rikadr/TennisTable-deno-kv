import { fmtNum } from "../../common/number-utils";
import { Shimmer } from "../../common/shimmer";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ThemedPlaceNumber } from "../leaderboard/themed-place-number";
import { ProfilePicture } from "../player/profile-picture";

export const PlayerPageNew: React.FC = () => {
  const { playerId } = useTennisParams();
  const context = useEventDbContext();

  const summary = context.leaderboard.getPlayerSummary(playerId || "");
  //   const pendingGames = context.tournaments.findAllPendingGamesByPlayer(playerId);

  return (
    <div className="max-w-7xl mx-auto px-1 md:px-4">
      <div className="bg-secondary-background text-secondary-text rounded-t-2xl shadow-sm px-6 md:px-8 py-4">
        <div className="flex md:items-center gap-4">
          <div className="relative">
            <ProfilePicture playerId={playerId} border={8} size={150} shape="rounded" clickToEdit />
            {summary.isRanked && (
              <div className="absolute -bottom-1 -right-1">
                <Shimmer className="rounded-full" enabled={!!summary.rank && summary.rank <= 10}>
                  <ThemedPlaceNumber place={summary.rank} size="xs" />
                </Shimmer>
              </div>
            )}
          </div>

          {/* Player Info */}
          <div className="flex-1 flex flex-col gap-4 text-secondary-text md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{context.playerName(playerId)}</h1>
              {summary.isRanked ? (
                <div className="text-base">🏆 Rank {summary.rank} of ??</div>
              ) : (
                <div className="text-base">
                  <p>Not yet ranked.</p>
                  <p>
                    <span className="font-bold">
                      {fmtNum(summary.games.length)} of {fmtNum(context.client.gameLimitForRanked)}
                    </span>{" "}
                    required games played.
                  </p>
                </div>
              )}
            </div>
            <p className="text-2xl md:text-3xl font-bold">
              {fmtNum(summary.elo)} <span className="text-base font-light">points</span>
            </p>
          </div>
        </div>
      </div>

      {/** Rest of the page comes below here */}
    </div>
  );
};
