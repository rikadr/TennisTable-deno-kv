import { useSearchParams } from "react-router-dom";
import { AchievementType } from "../../client/client-db/achievements";
import { ACHIEVEMENT_LABELS } from "../player/player-achievements";

export const ACHIEVEMENTS_FILTER_PARAM = "filter";
export const ACHIEVEMENTS_VIEW_PARAM = "view";
export const ACHIEVEMENTS_SEARCH_PARAM = "q";
export const ACHIEVEMENTS_GROUP_PARAM = "group";

/** The value that means "no type filter". */
export const ALL_ACHIEVEMENTS = "all";

/** The value that means "no group filter". */
export const ALL_GROUPS = "all";

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

  // The search and the group of the recent list. A search replaces the
  // history entry, so the back button does not step through each keystroke.
  const search = searchParams.get(ACHIEVEMENTS_SEARCH_PARAM) ?? "";
  const group = searchParams.get(ACHIEVEMENTS_GROUP_PARAM) ?? ALL_GROUPS;

  function setSelectedType(type: string) {
    setSearchParams((previous) => achievementsParams(previous, { type }));
  }

  function setView(next: AchievementsView) {
    setSearchParams((previous) => achievementsParams(previous, { view: next }));
  }

  function setSearch(next: string) {
    setSearchParams((previous) => withParam(previous, ACHIEVEMENTS_SEARCH_PARAM, next, ""), { replace: true });
  }

  function setGroup(next: string) {
    setSearchParams((previous) => withParam(previous, ACHIEVEMENTS_GROUP_PARAM, next, ALL_GROUPS));
  }

  // One update for both, since a second update in the same event reads the
  // params from before the first.
  function clearSearchAndGroup() {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.delete(ACHIEVEMENTS_SEARCH_PARAM);
      params.delete(ACHIEVEMENTS_GROUP_PARAM);
      return params;
    });
  }

  return { selectedType, view, search, group, setSelectedType, setView, setSearch, setGroup, clearSearchAndGroup };
}

/** The params with one param set, or left out at its default value. */
function withParam(current: URLSearchParams, name: string, value: string, defaultValue: string): URLSearchParams {
  const params = new URLSearchParams(current);
  if (value === defaultValue) params.delete(name);
  else params.set(name, value);
  return params;
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
 * Link to the Details view of one achievement, from another page. Links inside
 * the achievements page use achievementsLink instead, which keeps the rest of
 * the url.
 */
export function achievementDetailsPageLink(type: string): string {
  const params = new URLSearchParams();
  params.set(ACHIEVEMENTS_FILTER_PARAM, type);
  params.set(ACHIEVEMENTS_VIEW_PARAM, "details");
  return `/achievements?${params.toString()}`;
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
