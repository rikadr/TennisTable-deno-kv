import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";
import { classNames } from "../../common/class-names";
import { useState } from "react";
import { Achievement, AchievementProgression } from "../../client/client-db/achievements";
import { Link } from "react-router-dom";

type Props = {
  playerId?: string;
};

export const ACHIEVEMENT_LABELS: Record<string, { title: string; description: string; icon: string }> = {
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
  "streak-player-20": {
    title: "Humiliation Streak",
    description: "Won 20 games in a row against the same opponent",
    icon: "👹",
  },
  "punching-bag": {
    title: "Punching Bag",
    description: "Lose 10 games in a row",
    icon: "🥊",
  },
  "never-give-up": {
    title: "Never Give Up",
    description: "Lose 20 games in a row",
    icon: "🫠",
  },
  "comeback-kid": {
    title: "Comeback Kid",
    description: "Win a game after losing 10 in a row",
    icon: "💪",
  },
  "unbreakable-spirit": {
    title: "Unbreakable Spirit",
    description: "Win a game after losing 20 in a row",
    icon: "💎",
  },
  "back-after-6-months": {
    title: "Welcome Back",
    description: "Return after 6 months of inactivity",
    icon: "👋",
  },
  "back-after-1-year": {
    title: "Long Time No See",
    description: "Return after 1 year of inactivity",
    icon: "🙈",
  },
  "back-after-2-years": {
    title: "Back From The Dead",
    description: "Return after 2 years of inactivity",
    icon: "💀",
  },
  "active-6-months": {
    title: "Regular",
    description: "Active for 6 months without a 30-day break",
    icon: "📅",
  },
  "active-1-year": {
    title: "Dedicated",
    description: "Active for 1 year without a 30-day break",
    icon: "🌟",
  },
  "active-2-years": {
    title: "Veteran",
    description: "Active for 2 years without a 30-day break",
    icon: "🎖️",
  },
  "tournament-participated": {
    title: "Competitor",
    description: "Participated in a tournament",
    icon: "🤝",
  },
  "tournament-winner": {
    title: "Champion",
    description: "Won a tournament",
    icon: "🏆",
  },
  "nice-game": {
    title: "Nice Game",
    description: "Play a game where total points scored is 69",
    icon: "👌",
  },
  "close-calls": {
    title: "Close Calls",
    description: "Play 5 games where all sets are decided by 2 points or less",
    icon: "😰",
  },
  "edge-lord": {
    title: "Edge Lord",
    description: "Play 20 games where all sets are decided by 2 points or less",
    icon: "🔪",
  },
  "consistency-is-key": {
    title: "Consistency is Key",
    description: "Play 5 games where all sets had the same score",
    icon: "🔑",
  },
  "variety-player": {
    title: "Variety Player",
    description: "Play against 10 different opponents",
    icon: "🎲",
  },
  "global-player": {
    title: "Global Player",
    description: "Play against 20 different opponents",
    icon: "🌍",
  },
  "best-friends": {
    title: "Best Friends",
    description: "Play 50 games with a single opponent within 1 year",
    icon: "💙",
  },
  "welcome-committee": {
    title: "Welcome Committee",
    description: "Be the first opponent for 3 different new players",
    icon: "👥",
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
    <div className="flex flex-col h-full sm:-mt-4 md:-mt-8">
      {/* Tabs */}
      <div className="flex border-b border-secondary-text">
        <button
          onClick={() => setActiveTab("achievements")}
          className={classNames(
            "px-6 py-3 font-medium transition-colors text-secondary-text",
            activeTab === "achievements" ? "border-b-2 border-secondary-text" : "hover:text-secondary-text/70",
          )}
        >
          Achievements ({achievements.length})
        </button>
        <button
          onClick={() => setActiveTab("progress")}
          className={classNames(
            "px-6 py-3 font-medium transition-colors text-secondary-text",
            activeTab === "progress" ? "border-b-2 border-secondary-text" : "hover:text-secondary-text/70",
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
          <ProgressTab progression={progression} playerId={playerId} />
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
            className="bg-background-secondary rounded-lg p-4 border border-secondary-text"
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">{label.icon}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-secondary-text">{label.title}</h3>
                  <span className="text-xs text-secondary-text">
                    {relativeTimeString(new Date(achievement.earnedAt))} - {dateString(achievement.earnedAt)}
                  </span>
                </div>
                <p className="text-sm text-secondary-text mt-1">{label.description}</p>

                {achievement.data && "opponent" in achievement.data && (
                  <p className="text-xs text-secondary-text/70 mt-2">
                    vs {context.playerName(achievement.data.opponent)}
                  </p>
                )}

                {achievement.data && "tournamentId" in achievement.data && (
                  <p className="text-xs text-secondary-text/70 mt-2">
                    Tournament:{" "}
                    {context.tournaments.getTournament(achievement.data.tournamentId)?.tournamentDb.name || "Unknown"}
                  </p>
                )}

                {achievement.data && "opponents" in achievement.data && achievement.data.opponents && (
                  <div className="mt-2 text-xs text-secondary-text/70">
                    Welcomed:{" "}
                    {achievement.data.opponents.map((player: string) => context.playerName(player)).join(", ")}
                  </div>
                )}

                {achievement.data && "firstGameInPeriod" in achievement.data && (
                  <p className="text-xs text-secondary-text/70 mt-2">
                    From {dateString(achievement.data.firstGameInPeriod)} to {dateString(achievement.earnedAt)}
                  </p>
                )}

                {achievement.data && "lastGameAt" in achievement.data && (
                  <p className="text-xs text-secondary-text/70 mt-2">
                    From {dateString(achievement.data.lastGameAt)} to {dateString(achievement.earnedAt)}
                  </p>
                )}

                {achievement.data && "startedAt" in achievement.data && (
                  <p className="text-xs text-secondary-text/70 mt-2">
                    From {dateString(achievement.data.startedAt)} to {dateString(achievement.earnedAt)}
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
};

const ProgressTab: React.FC<ProgressTabProps> = ({ progression, playerId }) => {
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
    <div className="space-y-4 text-secondary-text">
      {progressItems.map(({ type, label, data }) => {
        const hasTarget = "target" in data && !!data.target;
        const hasCurrent = "current" in data && !!data.current;
        const isComplete = hasTarget && hasCurrent && data.current! >= data.target!;
        const percentage = hasTarget && hasCurrent ? Math.min((data.current! / data.target!) * 100, 100) : 0;
        const hasEarned = data.earned > 0;

        return (
          <div
            key={type}
            className={classNames(
              "bg-background-secondary rounded-lg overflow-hidden border border-secondary-text transition-colors relative",
              hasEarned && "bg-green-500",
            )}
          >
            {/* Progress bar background */}
            {hasTarget && (
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className={classNames(
                    "h-full transition-all duration-300",
                    isComplete ? "bg-green-500" : "bg-blue-400",
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            )}

            <div className="relative p-4">
              <div className="flex items-start gap-4">
                <div className="text-3xl">{label.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold ">{label.title}</h3>
                        {hasTarget && <span className="text-lg font-bold">{percentage.toFixed(0)}%</span>}
                      </div>
                      <p className="text-sm text-secondary-text">{label.description}</p>
                    </div>
                    {data.earned > 0 && (
                      <div className="text-xs font-semibold px-2 py-1 rounded">
                        Earned {data.earned} time{data.earned > 1 && "s"}
                      </div>
                    )}
                  </div>

                  {hasTarget ? (
                    <>
                      {/* Progress info */}
                      <div className="mt-2">
                        <div className="text-sm text-secondary-text">
                          <span className="font-medium">
                            {type.startsWith("active-") || type.startsWith("back-after-")
                              ? formatTimePeriod(data.current)
                              : data.current}{" "}
                            /{" "}
                            {type.startsWith("active-") || type.startsWith("back-after-")
                              ? formatTimePeriod(data.target)
                              : data.target}
                          </span>
                        </div>
                      </div>

                      {/* Show last active time for back-after achievements */}
                      {type.startsWith("back-after-") && "lastActiveAt" in data && data.lastActiveAt && (
                        <div className="mt-2 text-xs text-secondary-text/70">
                          Last active: {dateString(data.lastActiveAt)}
                        </div>
                      )}

                      {/* Show start date for active achievements */}
                      {type.startsWith("active-") && "current" in data && !!data.current && (
                        <div className="mt-2 text-xs text-secondary-text/70">
                          Since: {dateString(Date.now() - data.current)}
                        </div>
                      )}

                      {/* Per-opponent breakdown for streak achievements */}
                      {(type === "streak-player-10" || type === "streak-player-20") &&
                        "perOpponent" in data &&
                        data.perOpponent &&
                        data.perOpponent.size > 0 && (
                          <div className="mt-3 pt-3 border-t border-secondary-text/50">
                            <p className="text-xs text-secondary-text/70 mb-2">Current highest streaks:</p>
                            <div className="space-y-1 w-fit">
                              {Array.from(data.perOpponent.entries() as IterableIterator<[string, number]>)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 5)
                                .map(([opponent, streak]) => (
                                  <div
                                    key={opponent}
                                    className={classNames(
                                      "flex items-center justify-between text-xs",
                                      streak >= data.target && "line-through",
                                    )}
                                  >
                                    <Link to={"/player/" + opponent}>
                                      <span className="text-secondary-text">{context.playerName(opponent)}</span>
                                    </Link>
                                    <span className="font-medium ml-2">
                                      {streak}/{data.target}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                      {/* Per-opponent breakdown for best-friends achievement */}
                      {type === "best-friends" &&
                        "perOpponent" in data &&
                        data.perOpponent &&
                        data.perOpponent.size > 0 && (
                          <div className="mt-3 pt-3 border-t border-secondary-text/50">
                            <p className="text-xs text-secondary-text/70 mb-2">Games with opponents:</p>
                            <div className="space-y-1 w-fit">
                              {Array.from(
                                data.perOpponent.entries() as IterableIterator<
                                  [string, { count: number; timespan: number }]
                                >,
                              )
                                .sort((a, b) => b[1].count - a[1].count)
                                .slice(0, 5)
                                .map(([opponent, info]) => {
                                  const days = Math.floor(info.timespan / (24 * 60 * 60 * 1000));
                                  // Check if achievement already earned with this opponent
                                  const alreadyEarned = context.achievements
                                    .getAchievements(playerId)
                                    .some(
                                      (achievement) =>
                                        achievement.type === "best-friends" &&
                                        achievement.data &&
                                        "opponent" in achievement.data &&
                                        achievement.data.opponent === opponent,
                                    );
                                  return (
                                    <div
                                      key={opponent}
                                      className={classNames(
                                        "flex items-center justify-between text-xs gap-4",
                                        alreadyEarned && "line-through",
                                      )}
                                    >
                                      <Link to={"/player/" + opponent}>
                                        <span className="text-secondary-text">{context.playerName(opponent)}</span>
                                      </Link>
                                      <span className="font-medium">
                                        {info.count} games in last {days} days
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                      {/* New players list for welcome-committee achievement */}
                      {type === "welcome-committee" &&
                        "newPlayers" in data &&
                        data.newPlayers &&
                        data.newPlayers.size > 0 && (
                          <div className="mt-3 pt-3 border-t border-secondary-text/50">
                            <p className="text-xs text-secondary-text/70 mb-2">First opponent for:</p>
                            <div className="flex flex-wrap gap-1">
                              {Array.from(data.newPlayers).map((player: string) => (
                                <Link to={"/player/" + player} key={player}>
                                  <span className="text-xs bg-background px-2 py-1 rounded text-secondary-text">
                                    {context.playerName(player)}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                    </>
                  ) : (
                    // Fallback for achievements without targets (like tournament achievements)
                    <div className="mt-2 text-xs text-secondary-text/70">
                      {data.earned > 0 ? `Earned ${data.earned} time${data.earned > 1 ? "s" : ""}` : "No progress yet"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Helper function to format milliseconds into readable time periods
function formatTimePeriod(ms?: number): string {
  if (ms === undefined) {
    return "-";
  }
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return `${days} day${days !== 1 ? "s" : ""}`;
}

export function dateString(time: number) {
  return new Date(time).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
