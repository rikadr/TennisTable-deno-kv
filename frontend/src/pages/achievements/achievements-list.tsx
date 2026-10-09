import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Achievement } from "../../client/client-db/achievements";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { getAchievementLabel } from "../player/player-achievements";
import {
  ACHIEVEMENT_GROUPS,
  ACHIEVEMENT_TYPE_TO_GROUP_ID,
  OTHER_ACHIEVEMENT_GROUP,
} from "../player/achievement-groups";
import { calendarDaysBetween, clockTimeString, fullDateString } from "../../common/date-utils";
import { classNames } from "../../common/class-names";
import { ProfilePicture } from "../player/profile-picture";
import { achievementsLink, ALL_GROUPS, useAchievementsFilter } from "./use-achievements-filter";
import { AchievementFacts } from "./achievement-facts";

/** The rows the list shows first, and adds for each "Show more". */
const RECENT_PAGE_SIZE = 100;

const GROUPS = [...ACHIEVEMENT_GROUPS, OTHER_ACHIEVEMENT_GROUP];

function groupOf(type: string): string {
  return ACHIEVEMENT_TYPE_TO_GROUP_ID.get(type) ?? OTHER_ACHIEVEMENT_GROUP.id;
}

interface AchievementsListProps {
  achievements: Achievement[];
  /** The group chips filter the list only when no single achievement is selected. */
  showGroups: boolean;
}

export const AchievementsList: React.FC<AchievementsListProps> = ({ achievements, showGroups }) => {
  const context = useEventDbContext();
  const [searchParams] = useSearchParams();
  const { search, group, setSearch, setGroup, clearSearchAndGroup } = useAchievementsFilter();
  const [visibleCount, setVisibleCount] = useState(RECENT_PAGE_SIZE);

  const query = search.trim().toLowerCase();
  // A url can name a group that does not exist. It reads as no group.
  const selectedGroup = showGroups && GROUPS.some((candidate) => candidate.id === group) ? group : ALL_GROUPS;

  // The search matches the achievement's title, description and type, and the
  // name of the player who earned it.
  const searched = useMemo(() => {
    if (!query) return achievements;
    const labelText = new Map<string, string>();
    return achievements.filter((achievement) => {
      let text = labelText.get(achievement.type);
      if (text === undefined) {
        const label = getAchievementLabel(achievement.type, context.client.gameLimitForRanked);
        text = `${label.title} ${label.description} ${achievement.type}`.toLowerCase();
        labelText.set(achievement.type, text);
      }
      return text.includes(query) || context.playerName(achievement.earnedBy).toLowerCase().includes(query);
    });
  }, [achievements, query, context]);

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    searched.forEach((achievement) => {
      const id = groupOf(achievement.type);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    return counts;
  }, [searched]);

  const shown = useMemo(
    () =>
      selectedGroup === ALL_GROUPS
        ? searched
        : searched.filter((achievement) => groupOf(achievement.type) === selectedGroup),
    [searched, selectedGroup],
  );

  useEffect(() => setVisibleCount(RECENT_PAGE_SIZE), [shown]);

  // The visible rows under one heading for each calendar day. The count of a
  // day is over all the rows that match, also the rows not yet shown.
  const days = useMemo(() => {
    const countOfDay = new Map<string, number>();
    shown.forEach((achievement) => {
      const key = new Date(achievement.earnedAt).toDateString();
      countOfDay.set(key, (countOfDay.get(key) ?? 0) + 1);
    });

    const result: { key: string; time: number; count: number; items: Achievement[] }[] = [];
    shown.slice(0, visibleCount).forEach((achievement) => {
      const key = new Date(achievement.earnedAt).toDateString();
      const last = result[result.length - 1];
      if (last?.key === key) last.items.push(achievement);
      else result.push({ key, time: achievement.earnedAt, count: countOfDay.get(key) ?? 0, items: [achievement] });
    });
    return result;
  }, [shown, visibleCount]);

  if (achievements.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🏆</div>
        <p>No achievements yet</p>
        <p className="text-sm/70 mt-2">Keep playing to unlock achievements!</p>
      </div>
    );
  }

  const remaining = shown.length - visibleCount;

  return (
    <div className="max-w-3xl">
      <div className="space-y-2 mb-2">
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search achievement or player…"
            aria-label="Search achievements by name or player"
            className="w-full min-w-0 flex-1 px-3 py-2 bg-secondary-background text-secondary-text border border-secondary-text rounded-lg text-sm placeholder:text-secondary-text/50"
          />
          <span className="text-xs opacity-70 whitespace-nowrap">
            {shown.length} achievement{shown.length !== 1 && "s"}
          </span>
        </div>

        {showGroups && (
          <div
            role="radiogroup"
            aria-label="Filter achievements by group"
            className="flex gap-1.5 overflow-x-auto scrollbar-hide sm:flex-wrap"
          >
            {[{ id: ALL_GROUPS, icon: "", title: "All" }, ...GROUPS].map((candidate) => {
              const count = candidate.id === ALL_GROUPS ? searched.length : (groupCounts.get(candidate.id) ?? 0);
              if (candidate.id === OTHER_ACHIEVEMENT_GROUP.id && count === 0) return null;
              const isSelected = selectedGroup === candidate.id;
              return (
                <button
                  key={candidate.id}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setGroup(candidate.id)}
                  className={classNames(
                    "shrink-0 whitespace-nowrap rounded-full border border-secondary-text px-2.5 py-1 text-xs transition-colors",
                    isSelected
                      ? "bg-secondary-text text-secondary-background font-medium"
                      : "bg-secondary-background text-secondary-text hover:bg-secondary-text/20",
                    !isSelected && count === 0 && "opacity-50",
                  )}
                >
                  {candidate.icon && `${candidate.icon} `}
                  {candidate.title} <span className="opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {shown.length === 0 && (
        <div className="text-center py-8 text-sm">
          <p className="opacity-70">No achievements match the search and the group.</p>
          <button onClick={clearSearchAndGroup} className="mt-2 underline">
            Clear the search and the group
          </button>
        </div>
      )}

      {days.map((day) => (
        <div key={day.key} className="mb-2">
          {/* The day stays pinned below the fixed nav (h-16, md:h-12). */}
          <div className="sticky top-16 md:top-12 z-10 flex items-baseline justify-between gap-2 py-1 border-b border-primary-text/30 bg-primary-background">
            <h2 className="text-sm font-semibold">
              <DayHeading time={day.time} />
            </h2>
            <span className="text-xs opacity-60 whitespace-nowrap">{day.count}</span>
          </div>

          <ul className="divide-y divide-primary-text/10">
            {day.items.map((achievement, index) => {
              const label = getAchievementLabel(achievement.type, context.client.gameLimitForRanked);
              const detailsLink = achievementsLink(searchParams, { type: achievement.type, view: "details" });

              return (
                <li
                  key={`${achievement.type}-${achievement.earnedBy}-${achievement.earnedAt}-${index}`}
                  className="flex items-start gap-3 py-1.5"
                >
                  <Link
                    to={detailsLink}
                    title={label.description}
                    className="text-3xl leading-none w-9 shrink-0 text-center"
                  >
                    {label.icon}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <Link
                        to={detailsLink}
                        title={`${label.title} stats`}
                        className="font-semibold text-sm whitespace-nowrap hover:underline"
                      >
                        {label.title}
                      </Link>
                      <p className="flex-1 min-w-0 text-xs opacity-60 truncate hidden sm:block">{label.description}</p>
                      <span className="ml-auto text-[11px] opacity-60 whitespace-nowrap tabular-nums">
                        {clockTimeString(achievement.earnedAt)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      <Link
                        to={`/player/${achievement.earnedBy}?tab=achievements`}
                        className="flex gap-1.5 items-center rounded-full pr-2.5 p-0.5 bg-primary-background/50 ring-1 ring-primary-text/10"
                      >
                        <ProfilePicture playerId={achievement.earnedBy} size={18} border={1} />
                        <span className="text-xs font-medium">{context.playerName(achievement.earnedBy)}</span>
                      </Link>
                      <AchievementFacts achievement={achievement} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {remaining > 0 && (
        <button
          onClick={() => setVisibleCount((count) => count + RECENT_PAGE_SIZE)}
          className="w-full mt-3 py-2 rounded-lg border border-secondary-text bg-secondary-background text-secondary-text text-sm hover:bg-secondary-text/20"
        >
          Show {Math.min(RECENT_PAGE_SIZE, remaining)} more ({remaining} left)
        </button>
      )}
    </div>
  );
};

/** "Today", "Yesterday", or the date with the weekday and how long ago it was. */
const DayHeading: React.FC<{ time: number }> = ({ time }) => {
  const daysAgo = calendarDaysBetween(time, Date.now());
  if (daysAgo === 0) return <>Today</>;
  if (daysAgo === 1) return <>Yesterday</>;
  return (
    <>
      {fullDateString(time)} <span className="font-normal opacity-60">· {daysAgo} days ago</span>
    </>
  );
};
