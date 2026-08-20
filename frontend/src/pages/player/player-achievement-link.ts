/**
 * The player page carries its achievements state in the url: the sub-tab, and
 * the achievement a link points at. A link from the achievements page can name
 * a player and an achievement, and land on that achievement's progress row.
 */

export const PLAYER_ACHIEVEMENTS_TAB_PARAM = "achievementTab";
export const PLAYER_ACHIEVEMENT_PARAM = "achievement";

/** Link to a player's progress for one achievement type. */
export function playerAchievementProgressLink(playerId: string, type: string): string {
  const params = new URLSearchParams({ tab: "achievements" });
  params.set(PLAYER_ACHIEVEMENTS_TAB_PARAM, "progress");
  params.set(PLAYER_ACHIEVEMENT_PARAM, type);
  return `/player/${playerId}?${params.toString()}`;
}

/** Dom id of a progress row, which the link uses to scroll to the row. */
export function playerAchievementRowId(type: string): string {
  return `achievement-progress-${type}`;
}
