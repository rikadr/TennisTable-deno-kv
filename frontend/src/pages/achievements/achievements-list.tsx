import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Achievement } from "../../client/client-db/achievements";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { getAchievementLabel } from "../player/player-achievements";
import { calendarDaysBetween, clockTimeString, fullDateString } from "../../common/date-utils";
import { ProfilePicture } from "../player/profile-picture";
import { achievementsLink, useAchievementsFilter } from "./use-achievements-filter";
import { AchievementFacts } from "./achievement-facts";

/** The rows the list shows first, and adds for each "Show more". */
const RECENT_PAGE_SIZE = 100;

interface AchievementsListProps {
  achievements: Achievement[];
}

export const AchievementsList: React.FC<AchievementsListProps> = ({ achievements }) => {
  const context = useEventDbContext();
  const [searchParams] = useSearchParams();
  const { search, setSearch } = useAchievementsFilter();
  const [visibleCount, setVisibleCount] = useState(RECENT_PAGE_SIZE);

  const query = search.trim().toLowerCase();

  // The search matches the achievement's title, description and type, and the
  // name of the player who earned it.
  const shown = useMemo(() => {
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
      <div className="flex items-center gap-3 mb-2">
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

      {shown.length === 0 && (
        <div className="text-center text-sm py-8 opacity-70">No achievements match "{search.trim()}".</div>
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
          className="w-full mt-3 py-2 rounded-lg border border-secondary-text bg-secondary-background text-secondary-text text-sm hover:opacity-80"
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
