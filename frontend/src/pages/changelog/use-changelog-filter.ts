import { useSearchParams } from "react-router-dom";
import { ChangelogTag, isChangelogTag } from "../../client/changelog/changelog-tags";

export const CHANGELOG_TAGS_PARAM = "tags";

/**
 * The selected tags live in the url so a filtered changelog survives a reload
 * and can be shared as a link. Same pattern as the achievements page.
 */
export function useChangelogFilter() {
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedTags = (searchParams.get(CHANGELOG_TAGS_PARAM) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(isChangelogTag);

  function writeTags(tags: ChangelogTag[]) {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (tags.length === 0) {
          params.delete(CHANGELOG_TAGS_PARAM);
        } else {
          params.set(CHANGELOG_TAGS_PARAM, tags.join(","));
        }
        return params;
      },
      { replace: true },
    );
  }

  function toggleTag(tag: ChangelogTag) {
    writeTags(selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag]);
  }

  function clearTags() {
    writeTags([]);
  }

  return { selectedTags, toggleTag, clearTags };
}

/** Link target for a tag-filtered changelog, used from post pages. */
export function changelogFilterLink(tag: ChangelogTag): string {
  return `/changelog?${CHANGELOG_TAGS_PARAM}=${tag}`;
}
