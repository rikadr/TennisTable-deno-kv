import { useEventDbContext } from "../wrappers/event-db-context";
import { relativeTimeString } from "../common/date-utils";
import { useState, useMemo } from "react";
import { Achievement } from "../client/client-db/achievements";
import { ACHIEVEMENT_LABELS, dateString } from "./player/player-achievements";
import { Link } from "react-router-dom";
import { ProfilePicture } from "./player/profile-picture";
import { stringToColor } from "../common/string-to-color";

export const AchievementsPage: React.FC = () => {
  const context = useEventDbContext();
  const [selectedType, setSelectedType] = useState<string>("all");

  context.achievements.calculateAchievements();

  // Collect all achievements from all players
  const allAchievements = useMemo(() => {
    const achievements: Achievement[] = [];
    context.achievements.achievementMap.forEach((playerAchievements) => {
      achievements.push(...playerAchievements);
    });
    return achievements;
  }, [context.achievements.achievementMap]);

  // Count achievements by type
  const achievementCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allAchievements.forEach((achievement) => {
      counts[achievement.type] = (counts[achievement.type] || 0) + 1;
    });
    return counts;
  }, [allAchievements]);

  // Get all achievement types (including those with 0 earned)
  const achievementTypes = useMemo(() => {
    const allTypes = Object.keys(ACHIEVEMENT_LABELS);
    return allTypes.sort((a, b) => {
      const countA = achievementCounts[a] || 0;
      const countB = achievementCounts[b] || 0;
      return countB - countA; // Sort by count descending
    });
  }, [achievementCounts]);

  // Filter and sort achievements
  const filteredAchievements = useMemo(() => {
    let filtered = allAchievements;

    if (selectedType !== "all") {
      filtered = filtered.filter((a) => a.type === selectedType);
    }

    // Sort by date (most recent first)
    return filtered.sort((a, b) => b.earnedAt - a.earnedAt);
  }, [allAchievements, selectedType]);

  return (
    <div className="flex flex-col h-full text-primary-text bg-primary-background">
      {/* Header with filter */}
      <div className="p-6 border-b border-primary-text">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-primary-text">All Achievements</h1>
          <div className="text-sm">
            {filteredAchievements.length} achievement{filteredAchievements.length !== 1 && "s"}
          </div>
        </div>

        {/* Filter dropdown */}
        <div className="flex items-center gap-3">
          <label htmlFor="achievement-filter" className="text-sm font-medium">
            Filter:
          </label>
          <select
            id="achievement-filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-secondary-background text-secondary-text border border-primary-text rounded text-sm"
          >
            <option value="all">All Achievements ({allAchievements.length})</option>
            {achievementTypes.map((type) => {
              const label = ACHIEVEMENT_LABELS[type] || { title: type, icon: "🏅" };
              return (
                <option key={type} value={type}>
                  {label.icon} {label.title} ({achievementCounts[type] ?? 0})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Achievements list */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredAchievements.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏆</div>
            <p>No achievements yet</p>
            <p className="text-sm/70 mt-2">Keep playing to unlock achievements!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAchievements.map((achievement, index) => {
              const label = ACHIEVEMENT_LABELS[achievement.type] || {
                title: achievement.type,
                description: "",
                icon: "🏅",
              };

              return (
                <div
                  key={`${achievement.type}-${achievement.earnedBy}-${achievement.earnedAt}-${index}`}
                  className="bg-background-secondary rounded-lg p-4 border border-primary-text hover:border-accent/50 transition-colors text-primary-text"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{label.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-primary-text">{label.title}</h3>
                          <p className="text-sm mt-1">{label.description}</p>
                        </div>
                        <span className="text-xs whitespace-nowrap ml-4">
                          {relativeTimeString(new Date(achievement.earnedAt))} - {dateString(achievement.earnedAt)}
                        </span>
                      </div>
                      <div>
                        {achievement.data && "opponent" in achievement.data && (
                          <span className="text-xs">vs {context.playerName(achievement.data.opponent)}</span>
                        )}
                        {achievement.data && "tournamentId" in achievement.data && (
                          <span className="text-xs">
                            Tournament:{" "}
                            {context.tournaments.getTournament(achievement.data.tournamentId)?.tournamentDb.name ||
                              "Unknown"}
                          </span>
                        )}
                        {achievement.data && "opponents" in achievement.data && achievement.data.opponents && (
                          <div className="mt-2 text-xs">
                            Welcomed:{" "}
                            {achievement.data.opponents.map((player: string) => context.playerName(player)).join(", ")}
                          </div>
                        )}
                        {achievement.data && "firstGameInPeriod" in achievement.data && (
                          <span className="text-xs">
                            From {dateString(achievement.data.firstGameInPeriod)} to {dateString(achievement.earnedAt)}
                          </span>
                        )}
                        {achievement.data && "startedAt" in achievement.data && (
                          <p className="text-xs mt-2">
                            From {dateString(achievement.data.startedAt)} to {dateString(achievement.earnedAt)}
                          </p>
                        )}
                        {achievement.data && "lastGameAt" in achievement.data && (
                          <p className="text-xs mt-2">
                            From {dateString(achievement.data.lastGameAt)} to {dateString(achievement.earnedAt)}
                          </p>
                        )}
                        <div
                          className="rounded-full w-fit mt-2"
                          style={{ background: stringToColor(achievement.earnedBy) }}
                        >
                          <Link to={"/player/" + achievement.earnedBy} className="flex gap-3 items-center pr-4 p-1 ">
                            <ProfilePicture playerId={achievement.earnedBy} size={20} />
                            <span className="text-sm text-accent font-medium">
                              {context.playerName(achievement.earnedBy)}
                            </span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
