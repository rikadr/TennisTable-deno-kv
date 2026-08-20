import { useSearchParams } from "react-router-dom";
import { AchievementType } from "../../client/client-db/achievements";
import { ACHIEVEMENT_LABELS } from "../player/player-achievements";

export const ACHIEVEMENTS_FILTER_PARAM = "filter";
export const ACHIEVEMENTS_VIEW_PARAM = "view";

/** The value that means "no type filter". */
export const ALL_ACHIEVEMENTS = "all";

/**
 * The three views of the achievements page. "recent" is the default and needs
 * no param: the list of every earning, newest first.
 */
export type AchievementsView = "recent" | "details" | "progress";

export const ACHIEVEMENTS_VIEWS: { id: AchievementsView; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "details", label: "Details" },
  { id: "progress", label: "Progress" },
];

/**
 * The selected type and the view live in the url, so a view of the page
 * survives a reload and can be shared as a link. Both are pushed to the
 * history, so the browser back button returns to the view you came from.
 */
export function useAchievementsFilter() {
  const [searchParams, setSearchParams] = useSearchParams();

  // A url can name an achievement that does not exist, from a typo or from a
  // link to a type the app no longer has. It reads as no filter at all, which
  // every view can show.
  const typeParam = searchParams.get(ACHIEVEMENTS_FILTER_PARAM);
  const selectedType = typeParam !== null && isAchievementType(typeParam) ? typeParam : ALL_ACHIEVEMENTS;
  const viewParam = searchParams.get(ACHIEVEMENTS_VIEW_PARAM);
  const view: AchievementsView = ACHIEVEMENTS_VIEWS.some((candidate) => candidate.id === viewParam)
    ? (viewParam as AchievementsView)
    : "recent";

  function setSelectedType(type: string) {
    setSearchParams((previous) => achievementsParams(previous, { type }));
  }

  function setView(next: AchievementsView) {
    setSearchParams((previous) => achievementsParams(previous, { view: next }));
  }

  return { selectedType, view, setSelectedType, setView };
}

/** Whether a name from the url is an achievement the app knows. */
export function isAchievementType(type: string): type is AchievementType {
  return Object.prototype.hasOwnProperty.call(ACHIEVEMENT_LABELS, type);
}

/**
 * The url params of the page, with the given changes applied. A param at its
 * default value is left out, which keeps a shared link short.
 */
export function achievementsParams(
  current: URLSearchParams,
  changes: { type?: string; view?: AchievementsView },
): URLSearchParams {
  const params = new URLSearchParams(current);

  if (changes.type !== undefined) {
    if (changes.type === ALL_ACHIEVEMENTS) params.delete(ACHIEVEMENTS_FILTER_PARAM);
    else params.set(ACHIEVEMENTS_FILTER_PARAM, changes.type);
  }

  if (changes.view !== undefined) {
    if (changes.view === "recent") params.delete(ACHIEVEMENTS_VIEW_PARAM);
    else params.set(ACHIEVEMENTS_VIEW_PARAM, changes.view);
  }

  return params;
}

/**
 * Link target inside the achievements page. A search-only target keeps the
 * current path. An empty query still needs the "?", since react-router reads an
 * empty target as the root path.
 */
export function achievementsLink(
  current: URLSearchParams,
  changes: { type?: string; view?: AchievementsView },
): string {
  return `?${achievementsParams(current, changes).toString()}`;
}
