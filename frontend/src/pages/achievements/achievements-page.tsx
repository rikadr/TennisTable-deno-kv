import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { Achievement, AchievementType } from "../../client/client-db/achievements";
import { ACHIEVEMENT_LABELS } from "../player/player-achievements";
import { AchievementsList } from "./achievements-list";
import { ProgressList } from "./progress-list";
import { AchievementDetails } from "./achievement-details";
import { AchievementLeagueStats } from "./achievement-league-stats";
import {
  ACHIEVEMENTS_VIEWS,
  achievementsLink,
  ALL_ACHIEVEMENTS,
  useAchievementsFilter,
} from "./use-achievements-filter";

export const AchievementsPage: React.FC = () => {
  const context = useEventDbContext();
  const [searchParams] = useSearchParams();
  const { selectedType, view, setSelectedType, setView } = useAchievementsFilter();

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
    const allTypes = Object.keys(ACHIEVEMENT_LABELS) as AchievementType[];
    return allTypes.sort((a, b) => {
      const countA = achievementCounts[a] || 0;
      const countB = achievementCounts[b] || 0;
      return countB - countA; // Sort by count descending
    });
  }, [achievementCounts]);

  // Filter and sort achievements
  const filteredAchievements = useMemo(() => {
    let filtered = allAchievements;

    if (selectedType !== ALL_ACHIEVEMENTS) {
      filtered = filtered.filter((a) => a.type === selectedType);
    }

    // Sort by date (most recent first)
    return filtered.sort((a, b) => b.earnedAt - a.earnedAt);
  }, [allAchievements, selectedType]);

  return (
    <div className="flex flex-col h-full text-primary-text bg-primary-background">
      {/* Header with the filter and the three views */}
      <div className="p-6 pb-0 border-b border-primary-text">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-primary-text">All Achievements</h1>
          {view === "recent" && (
            <div className="text-sm">
              {filteredAchievements.length} achievement
              {filteredAchievements.length !== 1 && "s"}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label htmlFor="achievement-filter" className="text-sm font-medium">
            Filter:
          </label>
          <select
            id="achievement-filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-secondary-background text-secondary-text border border-secondary-text rounded text-sm min-w-[200px]"
          >
            <option value={ALL_ACHIEVEMENTS}>All Achievements ({allAchievements.length})</option>
            {achievementTypes.map((type) => {
              const label = ACHIEVEMENT_LABELS[type];
              return (
                <option key={type} value={type}>
                  {label.icon} {label.title} ({achievementCounts[type] ?? 0})
                </option>
              );
            })}
          </select>
        </div>

        {/* The three views of the same achievement: its earnings, its stats,
            and everyone's progress towards it. */}
        <div className="flex space-x-2 overflow-x-auto flex-nowrap scrollbar-hide">
          {ACHIEVEMENTS_VIEWS.map((candidate) => (
            <button
              key={candidate.id}
              onClick={() => setView(candidate.id)}
              className={classNames(
                "flex items-center py-2 px-4 border-b-4 font-medium text-sm transition-colors shrink-0 whitespace-nowrap",
                view === candidate.id
                  ? "text-primary-text border-primary-text"
                  : "text-primary-text/80 border-transparent hover:text-primary-text hover:border-primary-text border-dotted",
              )}
            >
              {candidate.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {view === "recent" && <AchievementsList achievements={filteredAchievements} />}
        {view === "details" &&
          (selectedType === ALL_ACHIEVEMENTS ? (
            <AchievementLeagueStats detailsLink={(type) => achievementsLink(searchParams, { type, view: "details" })} />
          ) : (
            <AchievementDetails
              type={selectedType as AchievementType}
              earnedCount={filteredAchievements.length}
              onShowProgress={() => setView("progress")}
              onShowRecent={() => setView("recent")}
            />
          ))}
        {view === "progress" && <ProgressList selectedType={selectedType} />}
      </div>
    </div>
  );
};
