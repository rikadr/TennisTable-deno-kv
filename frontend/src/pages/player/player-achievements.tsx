import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";
import { classNames } from "../../common/class-names";
import { useState } from "react";
import { Achievement, AchievementProgression } from "../../client/client-db/achievements";

type Props = {
  playerId?: string;
};

const ACHIEVEMENT_LABELS: Record<string, { title: string; description: string; icon: string }> = {
  "donut-1": {
    title: "Donut",
    description: "Won a set without opponent scoring",
    icon: "🍩",
  },
  "donut-5": {
    title: "Donuts to Share",
    description: "Won 5 donut sets total",
    icon: "🥯",
  },
  "streak-all-10": {
    title: "Unstoppable",
    description: "Won 10 games in a row",
    icon: "🔥",
  },
  "streak-player-10": {
    title: "Domination Streak",
    description: "Won 10 games in a row against the same opponent",
    icon: "🎯",
  },
  // TODO "streak-player-20" "Humiliation streak"
  "back-after-6-months": {
    title: "Welcome Back",
    description: "Returned after 6 months",
    icon: "👋",
  },
  "back-after-1-year": {
    title: "Long Time No See",
    description: "Returned after 1 year",
    icon: "🙈",
  },
  "back-after-2-years": {
    title: "Back From The Dead",
    description: "Returned after 2 years",
    icon: "💀",
  },
  "active-6-months": {
    title: "Regular",
    description: "Active for 6 months",
    icon: "📅",
  },
  "active-1-year": {
    title: "Dedicated",
    description: "Active for 1 year",
    icon: "🌟",
  },
  "active-2-years": {
    title: "Veteran",
    description: "Active for 2 years",
    icon: "🎖️",
  },
};

export const PlayerAchievements: React.FC<Props> = ({ playerId }) => {
  const context = useEventDbContext();
  const [activeTab, setActiveTab] = useState<"achievements" | "progress">("achievements");

  context.achievements.calculateAchievements();

  if (!playerId) {
    return <div className="p-8 text-center text-secondary-text/70">No player selected</div>;
  }

  const achievements = context.achievements.getAchievements(playerId);
  const progression = context.achievements.getPlayerProgression(playerId);

  // Sort achievements by date (most recent first)
  const sortedAchievements = [...achievements].sort((a, b) => b.earnedAt - a.earnedAt);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("achievements")}
          className={classNames(
            "px-6 py-3 font-medium transition-colors",
            activeTab === "achievements"
              ? "text-primary-text border-b-2 border-accent"
              : "text-secondary-text hover:text-primary-text",
          )}
        >
          Achievements ({achievements.length})
        </button>
        <button
          onClick={() => setActiveTab("progress")}
          className={classNames(
            "px-6 py-3 font-medium transition-colors",
            activeTab === "progress"
              ? "text-primary-text border-b-2 border-accent"
              : "text-secondary-text hover:text-primary-text",
          )}
        >
          Progress
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "achievements" ? (
          <AchievementsTab achievements={sortedAchievements} />
        ) : (
          <ProgressTab progression={progression} playerId={playerId} context={context} />
        )}
      </div>
    </div>
  );
};

type AchievementsTabProps = {
  achievements: Achievement[];
};

const AchievementsTab: React.FC<AchievementsTabProps> = ({ achievements }) => {
  const context = useEventDbContext();

  if (achievements.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🏆</div>
        <p className="text-secondary-text">No achievements yet</p>
        <p className="text-sm text-secondary-text/70 mt-2">Keep playing to unlock achievements!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {achievements.map((achievement, index) => {
        const label = ACHIEVEMENT_LABELS[achievement.type] || {
          title: achievement.type,
          description: "",
          icon: "🏅",
        };

        return (
          <div
            key={`${achievement.type}-${achievement.earnedAt}-${index}`}
            className="bg-background-secondary rounded-lg p-4 border border-border hover:border-accent/50 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">{label.icon}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-primary-text">{label.title}</h3>
                  <span className="text-xs text-secondary-text">
                    {relativeTimeString(new Date(achievement.earnedAt))}
                  </span>
                </div>
                <p className="text-sm text-secondary-text mt-1">{label.description}</p>
                {"opponent" in achievement.data && (
                  <p className="text-xs text-secondary-text/70 mt-2">
                    vs {context.playerName(achievement.data.opponent)}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

type ProgressTabProps = {
  progression: AchievementProgression;
  playerId: string;
  context: any;
};

const ProgressTab: React.FC<ProgressTabProps> = ({ progression }) => {
  const context = useEventDbContext();
  const progressItems = Object.entries(progression).map(([type, data]) => {
    const label = ACHIEVEMENT_LABELS[type] || {
      title: type,
      description: "",
      icon: "🏅",
    };

    return {
      type,
      label,
      data,
    };
  });

  return (
    <div className="space-y-4">
      {progressItems.map(({ type, label, data }) => {
        const hasTarget = "target" in data;
        const isComplete = hasTarget && data.current >= data.target;
        const percentage = hasTarget ? Math.min((data.current / data.target) * 100, 100) : 0;

        return (
          <div
            key={type}
            className={classNames(
              "bg-background-secondary rounded-lg p-4 border transition-colors",
              isComplete ? "border-accent/50 bg-accent/5" : "border-border",
            )}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">{label.icon}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-primary-text">{label.title}</h3>
                    <p className="text-sm text-secondary-text">{label.description}</p>
                  </div>
                  {data.earned > 0 && (
                    <div className="bg-accent/20 text-accent text-xs font-semibold px-2 py-1 rounded">
                      ×{data.earned}
                    </div>
                  )}
                </div>

                {hasTarget ? (
                  <>
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-secondary-text mb-1">
                        <span>
                          {data.current} / {data.target}
                        </span>
                        <span>{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className={classNames(
                            "h-full transition-all duration-300",
                            isComplete ? "bg-accent" : "bg-accent/70",
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Per-opponent breakdown for streak-player-10 */}
                    {type === "streak-player-10" &&
                      "perOpponent" in data &&
                      data.perOpponent &&
                      data.perOpponent.size > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <p className="text-xs text-secondary-text/70 mb-2">Current streaks:</p>
                          <div className="space-y-1 w-fit">
                            {Array.from(data.perOpponent.entries())
                              .sort((a, b) => b[1] - a[1])
                              .map(([opponent, streak]: [string, number]) => (
                                <div key={opponent} className="flex items-center justify-between text-xs">
                                  <span className="text-secondary-text">{context.playerName(opponent)}</span>
                                  <span className="text-primary-text font-medium ml-2">{streak}/10</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                    {/* Time-based progress display */}
                    {(type === "active-6-months" || type === "active-1-year" || type === "active-2-years") && (
                      <div className="mt-2 text-xs text-secondary-text/70">
                        {formatTimePeriod(data.current)} of {formatTimePeriod(data.target)}
                      </div>
                    )}
                  </>
                ) : (
                  // "Back after" achievements - no predictable progress
                  <div className="mt-2 text-xs text-secondary-text/70">
                    {data.earned > 0
                      ? `Earned ${data.earned} time${data.earned > 1 ? "s" : ""}`
                      : "Come back after a long break to earn this"}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Helper function to format milliseconds into readable time periods
function formatTimePeriod(ms: number): string {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years >= 2) {
    return `${years} years`;
  } else if (years === 1) {
    return "1 year";
  } else if (months >= 1) {
    return `${months} month${months > 1 ? "s" : ""}`;
  } else {
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
}
