/**
 * The tag vocabulary for the changelog. Deliberately small - five kinds of
 * change, so the filter row reads at a glance. A post carries one or two.
 */
export const CHANGELOG_TAGS = {
  "new-feature": { label: "New feature", icon: "✨" },
  "feature-update": { label: "Feature update", icon: "🔧" },
  "removed-feature": { label: "Removed feature", icon: "🗑️" },
  "bug-fix": { label: "Bug fix", icon: "🐛" },
  technical: { label: "Technical", icon: "⚙️" },
} as const;

export type ChangelogTag = keyof typeof CHANGELOG_TAGS;

export const ALL_CHANGELOG_TAGS = Object.keys(CHANGELOG_TAGS) as ChangelogTag[];

export function isChangelogTag(value: string): value is ChangelogTag {
  return value in CHANGELOG_TAGS;
}

export function changelogTagLabel(tag: ChangelogTag): string {
  return CHANGELOG_TAGS[tag].label;
}

export function changelogTagIcon(tag: ChangelogTag): string {
  return CHANGELOG_TAGS[tag].icon;
}
