// Logical sections for the player's achievement Progress tab. The groups and
// their order mirror the thematic key order of getPlayerProgression in
// client-db/achievements.ts, so the grouped view keeps the same reading order
// as the flat list did.
//
// A progression key missing from every group is not lost: the Progress tab
// collects leftovers into the OTHER_ACHIEVEMENT_GROUP at the end, so a new
// achievement type shows up even before it is placed in a section here.
export type AchievementGroup = {
  id: string;
  title: string;
  icon: string;
  types: string[];
};

export const ACHIEVEMENT_GROUPS: AchievementGroup[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "🚀",
    types: ["first-game", "ranked"],
  },
  {
    id: "win-streaks",
    title: "Win Streaks",
    icon: "🔥",
    types: [
      "streak-all-10",
      "streak-player-10",
      "streak-player-20",
      "hat-trick",
      "perfect-day",
      "perfect-week",
      "streak-ender",
      "party-pooper",
      "longest-win-streak",
    ],
  },
  {
    id: "resilience",
    title: "Resilience",
    icon: "💪",
    types: [
      "punching-bag",
      "never-give-up",
      "comeback-kid",
      "unbreakable-spirit",
      "longest-lose-streak",
      "yin-yang",
    ],
  },
  {
    id: "rank-and-score",
    title: "Rank & Score",
    icon: "👑",
    types: [
      "on-the-podium",
      "touched-the-throne",
      "kingslayer",
      "king-maker",
      "giant-hunting",
      "leap-frog",
      "david",
      "goliath",
      "climber",
      "full-house",
      "humbled",
      "everybodys-opponent",
    ],
  },
  {
    id: "game-feats",
    title: "Game Feats",
    icon: "🎯",
    types: [
      "donut-1",
      "donut-5",
      "nice-game",
      "less-is-more",
      "close-calls",
      "edge-lord",
      "consistency-is-key",
      "deuce-demon",
      "on-the-record",
      "photo-finish",
      "marathon-set",
      "shootout",
      "hero-of-the-day",
      "hero-of-the-week",
      "hero-of-the-month",
      "earliest-game",
      "latest-game",
    ],
  },
  {
    id: "social",
    title: "Social",
    icon: "🤝",
    types: [
      "variety-player",
      "global-player",
      "best-friends",
      "reunion",
      "welcome-committee",
      "community-builder",
    ],
  },
  {
    id: "loyalty-and-activity",
    title: "Loyalty & Activity",
    icon: "📅",
    types: [
      "active-6-months",
      "active-1-year",
      "active-2-years",
      "anniversary",
      "back-after-6-months",
      "back-after-1-year",
      "back-after-2-years",
      "retired",
      "back-from-the-dead",
    ],
  },
  {
    id: "competition",
    title: "Competition",
    icon: "🏆",
    types: [
      "tournament-participated",
      "tournament-winner",
      "group-stage-star",
      "sweet-revenge",
      "season-winner",
      "so-close",
      "full-coverage",
      "season-opener",
      "milestone-game",
    ],
  },
];

export const OTHER_ACHIEVEMENT_GROUP: AchievementGroup = {
  id: "other",
  title: "Other",
  icon: "🏅",
  types: [],
};

// type → group id, for per-group earned/total counts.
export const ACHIEVEMENT_TYPE_TO_GROUP_ID = new Map<string, string>(
  ACHIEVEMENT_GROUPS.flatMap((group) => group.types.map((type) => [type, group.id] as const)),
);

/**
 * The achievement types in the order the player's Progress tab lists them: the
 * groups in order, the types of a group in the group's own order, and last the
 * types in no group, in the order they are given.
 *
 * The achievements page walks this order with its Previous and Next buttons,
 * so the two pages read the achievements in the same order.
 */
export function orderAchievementTypes(types: string[]): string[] {
  const given = new Set(types);
  const grouped = ACHIEVEMENT_GROUPS.flatMap((group) => group.types.filter((type) => given.has(type)));
  const isGrouped = new Set(grouped);
  return [...grouped, ...types.filter((type) => !isGrouped.has(type))];
}
