import { useSearchParams } from "react-router-dom";

export const ACHIEVEMENTS_FILTER_PARAM = "filter";
export const ACHIEVEMENTS_VIEW_PARAM = "view";
export const ACHIEVEMENTS_PROGRESS_VIEW = "progress";

/** The value that means "no type filter". */
export const ALL_ACHIEVEMENTS = "all";

/**
 * The selected type and the view live in the url, so a filtered list survives a
 * reload and can be shared as a link. The filter is pushed to the history, so
 * the browser back button returns to the previous filter. The view toggle
 * replaces the entry, since it is a display choice and not a place to go back
 * to.
 */
export function useAchievementsFilter() {
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedType = searchParams.get(ACHIEVEMENTS_FILTER_PARAM) ?? ALL_ACHIEVEMENTS;
  const showProgress = searchParams.get(ACHIEVEMENTS_VIEW_PARAM) === ACHIEVEMENTS_PROGRESS_VIEW;

  function setSelectedType(type: string) {
    setSearchParams((previous) => achievementsFilterParams(previous, type));
  }

  function setShowProgress(progress: boolean) {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (progress) {
          params.set(ACHIEVEMENTS_VIEW_PARAM, ACHIEVEMENTS_PROGRESS_VIEW);
        } else {
          params.delete(ACHIEVEMENTS_VIEW_PARAM);
        }
        return params;
      },
      { replace: true },
    );
  }

  return { selectedType, showProgress, setSelectedType, setShowProgress };
}

/** The url params for a type filter, and it keeps the other params. */
export function achievementsFilterParams(current: URLSearchParams, type: string): URLSearchParams {
  const params = new URLSearchParams(current);
  if (type === ALL_ACHIEVEMENTS) {
    params.delete(ACHIEVEMENTS_FILTER_PARAM);
  } else {
    params.set(ACHIEVEMENTS_FILTER_PARAM, type);
  }
  return params;
}

/** Link target for a type-filtered list, used from the achievement names. */
export function achievementsFilterLink(current: URLSearchParams, type: string): string {
  const params = achievementsFilterParams(current, type);
  // A search-only target keeps the current path. An empty query still needs the
  // "?", since react-router reads an empty target as the root path.
  return `?${params.toString()}`;
}
