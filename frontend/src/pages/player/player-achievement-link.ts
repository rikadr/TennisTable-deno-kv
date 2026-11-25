/**
 * The player page carries its achievements state in the url: the sub-tab, and
 * the achievement a link points at. A link from the achievements page can name
 * a player and an achievement, and land on that achievement's progress row. A
 * link can also name one earned achievement, and land on its row in the Earned
 * tab.
 */

export const PLAYER_ACHIEVEMENTS_TAB_PARAM = "achievementTab";
export const PLAYER_ACHIEVEMENT_PARAM = "achievement";
export const PLAYER_EARNED_ACHIEVEMENT_PARAM = "earned";

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

/** Identifies one earned achievement of a player, in the url and in the dom. */
export function playerEarnedAchievementKey(type: string, earnedAt: number): string {
  return `${type}-${earnedAt}`;
}

/** Link to one earned achievement of a player, in the Earned tab. */
export function playerEarnedAchievementLink(playerId: string, type: string, earnedAt: number): string {
  const params = new URLSearchParams({ tab: "achievements" });
  params.set(PLAYER_ACHIEVEMENTS_TAB_PARAM, "earned");
  params.set(PLAYER_EARNED_ACHIEVEMENT_PARAM, playerEarnedAchievementKey(type, earnedAt));
  return `/player/${playerId}?${params.toString()}`;
}

/** Dom id of an earned row, which the link uses to scroll to the row. */
export function playerEarnedAchievementRowId(key: string): string {
  return `achievement-earned-${key}`;
}
