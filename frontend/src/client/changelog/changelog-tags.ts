/**
 * The tag vocabulary for the changelog.
 *
 * Tags are a flat, closed set so the filter row stays readable. A post carries
 * one or more of them - usually one "kind of change" tag (new feature, bug fix,
 * technical, ...) plus any area it belongs to (tournaments, seasons, ...).
 */
export const CHANGELOG_TAGS = {
  "new-feature": { label: "New feature", icon: "✨" },
  "bug-fix": { label: "Bug fix", icon: "🐛" },
  technical: { label: "Technical", icon: "⚙️" },
  architecture: { label: "Architecture", icon: "🏗️" },
  performance: { label: "Performance", icon: "⚡" },
  design: { label: "Design", icon: "🎨" },
  achievements: { label: "Achievements", icon: "🎖️" },
  tournaments: { label: "Tournaments", icon: "🏆" },
  seasons: { label: "Seasons", icon: "🍁" },
  predictions: { label: "Predictions", icon: "🔮" },
  admin: { label: "Admin", icon: "🔐" },
  experiment: { label: "Experiment", icon: "🧪" },
  fun: { label: "Fun", icon: "🎉" },
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
