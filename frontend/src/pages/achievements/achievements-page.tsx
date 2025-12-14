import { useState, useMemo } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { Achievement } from "../../client/client-db/achievements";
import { ACHIEVEMENT_LABELS } from "../player/player-achievements";
import { AchievementsList } from "./achievements-list";
import { ProgressList } from "./progress-list";

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

  // State for toggling the progress view
  const [showProgress, setShowProgress] = useState(false);

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
          <h1 className="text-2xl font-bold text-primary-text">
            All Achievements
          </h1>
          <div className="text-sm">
            {filteredAchievements.length} achievement
            {filteredAchievements.length !== 1 && "s"}
          </div>
        </div>

        {/* Filter dropdown and Progress toggle */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <label htmlFor="achievement-filter" className="text-sm font-medium">
              Filter:
            </label>
            <select
              id="achievement-filter"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
              }}
              className="px-3 py-2 bg-secondary-background text-secondary-text border border-primary-text rounded text-sm min-w-[200px]"
            >
              <option value="all">
                All Achievements ({allAchievements.length})
              </option>
              {achievementTypes.map((type) => {
                const label = ACHIEVEMENT_LABELS[type] || {
                  title: type,
                  icon: "🏅",
                };
                return (
                  <option key={type} value={type}>
                    {label.icon} {label.title} ({achievementCounts[type] ?? 0})
                  </option>
                );
              })}
            </select>
          </div>

          <button
            onClick={() => setShowProgress(!showProgress)}
            className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
              showProgress
                ? "bg-accent text-white border-accent"
                : "bg-secondary-background text-primary-text border-primary-text hover:border-accent"
            }`}
          >
            {showProgress ? "Show Recent Awards" : "See Everyone's Progress"}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {showProgress ? (
          <ProgressList selectedType={selectedType} />
        ) : (
          <AchievementsList achievements={filteredAchievements} />
        )}
      </div>
    </div>
  );
};
