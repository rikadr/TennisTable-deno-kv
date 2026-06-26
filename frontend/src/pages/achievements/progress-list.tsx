import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ACHIEVEMENT_LABELS, getAchievementLabel } from "../player/player-achievements";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";
import { classNames } from "../../common/class-names";

interface ProgressListProps {
  selectedType: string;
}

export const ProgressList: React.FC<ProgressListProps> = ({ selectedType }) => {
  const context = useEventDbContext();

  // Time-based achievements store current/target as raw milliseconds, which
  // would render as enormous numbers. Show them as whole days instead.
  const isTimePeriod =
    selectedType.startsWith("active-") || selectedType.startsWith("back-after-") || selectedType === "anniversary";

  // Calculate progress for all players when a specific type is selected
  const playersProgress = useMemo(() => {
    if (selectedType === "all") return [];

    const players = context.players;
    return players
      .map((player) => {
        const progression = context.achievements.getPlayerProgression(player.id);
        const specificProgression = progression[selectedType as keyof typeof progression];

        // Safely extract current and target if they exist
        // Use type narrowing or 'in' operator checks
        let current = 0;
        let target = 0;
        let percent = 0;
        let earned = 0;

        if (specificProgression && "earned" in specificProgression) {
          // @ts-ignore
          earned = specificProgression.earned;
        }

        if (
          specificProgression &&
          "target" in specificProgression &&
          "current" in specificProgression
        ) {
          // @ts-ignore - TS doesn't fully understand the discrimination here without strict checks
          current = specificProgression.current;
          // @ts-ignore
          target = specificProgression.target;
        } else if (specificProgression && "earned" in specificProgression) {
          current = earned;
          // For achievements without target (just 'earned' count), we can treat 1 as target if earned > 0
          // or just display the count. For sorting purpose, use earned.
          target = 1;
        }

        if (target > 0) {
          percent = Math.min(100, Math.round((current / target) * 100));
        }

        return {
          player,
          current,
          target,
          percent,
          earned,
          progression: specificProgression,
        };
      })
      .sort((a, b) => {
        // Sort by percent desc, then by current value desc
        if (b.percent !== a.percent) return b.percent - a.percent;
        return b.current - a.current;
      });
  }, [context.players, context.achievements, selectedType]);

  return (
    <div className="max-w-3xl mx-auto">
      {selectedType === "all" ? (
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
                {ACHIEVEMENT_LABELS[selectedType]?.icon}{" "}
                {ACHIEVEMENT_LABELS[selectedType]?.title}
              </span>
            </h2>
            <p className="text-sm opacity-70 mt-2">
              {getAchievementLabel(selectedType, context.client.gameLimitForRanked).description}
            </p>
          </div>

            {playersProgress.map(({ player, current, target, percent, earned }, index) => {
              const hasEarned = earned > 0;

              return (
                 <div
                  key={player.id}
                  className={classNames(
                    "rounded-lg overflow-hidden border border-primary-text/30 relative",
                    hasEarned
                      ? "bg-gradient-to-b from-green-400 via-green-500 to-green-600"
                      : "bg-background-secondary",
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
                    <div className="text-xl font-bold w-8 text-right opacity-50">
                      #{index + 1}
                    </div>

                    <Link to={`/player/${player.id}`} className="shrink-0">
                      <ProfilePicture playerId={player.id} size={45} border={3} />
                    </Link>

                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <Link
                          to={`/player/${player.id}`}
                          className="font-semibold hover:text-accent transition-colors"
                        >
                          {player.name}
                        </Link>
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

                    {target > 1 && (
                      <div className="text-lg font-bold w-16 text-right">
                        {percent}%
                      </div>
                    )}
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
