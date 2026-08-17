import { Player } from "../../client/client-db/event-store/projectors/players-projector";

export const RECENTLY_RETIRED_WINDOW = 7 * 24 * 60 * 60 * 1000;

export function isRecentlyRetired(player: Player): boolean {
  return player.active === false && Date.now() - player.updatedAt < RECENTLY_RETIRED_WINDOW;
}
