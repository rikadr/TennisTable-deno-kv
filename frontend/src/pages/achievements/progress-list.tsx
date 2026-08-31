import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ACHIEVEMENT_LABELS, getAchievementLabel } from "../player/player-achievements";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";
import { classNames } from "../../common/class-names";
import { AchievementType } from "../../client/client-db/achievements";
import { ALL_ACHIEVEMENTS } from "./use-achievements-filter";
import { playerAchievementProgressLink } from "../player/player-achievement-link";
import { playersProgressForType } from "./progress-rows";

interface ProgressListProps {
  selectedType: string;
}

export const ProgressList: React.FC<ProgressListProps> = ({ selectedType }) => {
  const context = useEventDbContext();

  // Time-based achievements store current/target as raw milliseconds, which
  // would render as enormous numbers. Show them as whole days instead.
  const isTimePeriod =
    selectedType.startsWith("active-") ||
    selectedType.startsWith("back-after-") ||
    selectedType === "anniversary" ||
    selectedType === "season-opener";

  const playersProgress = useMemo(
    () => (selectedType === ALL_ACHIEVEMENTS ? [] : playersProgressForType(context, selectedType)),
    [context, selectedType],
  );

  return (
    <div className="max-w-3xl mx-auto">
      {selectedType === ALL_ACHIEVEMENTS ? (
        <div className="text-center py-12 bg-background-secondary rounded-lg border border-primary-text/20">
          <div className="text-5xl mb-4">👆</div>
          <h3 className="text-xl font-semibold mb-2">Select an achievement</h3>
          <p className="opacity-70">
            Please select a specific achievement from the filter menu to see everyone's progress.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="mb-6">
            <h2 className="text-xl font-bold flex items-center gap-3">
              <span>Progress:</span>
              <span className="bg-background-secondary px-3 py-1 rounded-md border border-primary-text/20 flex items-center gap-2">
                {ACHIEVEMENT_LABELS[selectedType as AchievementType]?.icon}{" "}
                {ACHIEVEMENT_LABELS[selectedType as AchievementType]?.title}
              </span>
            </h2>
            <p className="text-sm opacity-70 mt-2">
              {getAchievementLabel(selectedType, context.client.gameLimitForRanked).description}
            </p>
          </div>

          {playersProgress.map(({ player, isRetired, current, target, percent, earned }, index) => {
            const hasEarned = earned > 0;

            return (
              <div
                key={player.id}
                className={classNames(
                  "rounded-lg overflow-hidden border border-primary-text/30 relative",
                  hasEarned ? "bg-gradient-to-b from-green-400 via-green-500 to-green-600" : "bg-background-secondary",
                )}
              >
                {/* Progress Background. The bar itself is always
                      blue; the green earned-row background shows
                      through behind it so an earned-but-progressing
                      achievement reads as "blue bar over green bg". */}
                {(target > 1 || current > 0) && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div
                      className="h-full transition-all duration-300 bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}

                <div className="relative px-4 py-2 flex items-center gap-4">
                  <div className="text-xl font-bold w-8 text-right opacity-50">#{index + 1}</div>

                  <Link to={playerAchievementProgressLink(player.id, selectedType)} className="shrink-0">
                    <ProfilePicture playerId={player.id} size={45} border={3} />
                  </Link>

                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to={playerAchievementProgressLink(player.id, selectedType)}
                          className="font-semibold hover:underline"
                        >
                          {player.name}
                        </Link>
                        {isRetired && (
                          <span className="bg-secondary-background text-secondary-text text-xs px-2 py-0.5 rounded-full font-normal shrink-0 ring-1 ring-primary-text/20">
                            Retired
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-mono">
                        {isTimePeriod
                          ? `${formatTimePeriod(current)} / ${formatTimePeriod(target)}`
                          : `${fmtNum(current)} ${target > 1 ? `/ ${fmtNum(target)}` : ""}`}
                      </span>
                    </div>

                    {/* Special handling for 'earned' counters if no target */}
                    {target <= 1 && (
                      <div className="text-xs opacity-70">
                        Earned {current} time{current !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  {target > 1 && <div className="text-lg font-bold w-16 text-right">{percent}%</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Format milliseconds into a readable whole-day count (e.g. "123 days").
function formatTimePeriod(ms: number): string {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return `${days} day${days !== 1 ? "s" : ""}`;
}
