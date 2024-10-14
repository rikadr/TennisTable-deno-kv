import { Router } from "oak";
import { comparePlayers } from "./compare-players.ts";

export function registerLeaderboardRoutes(api: Router) {
  /**
   * Get score timeline comparing multiple players
   */
  api.get("/compare-players", async (context) => {
    const params = context.request.url.searchParams.get("players");
    if (!params) {
      context.response.body = "No players provided";
      return;
    }
    const players = JSON.parse(params) as string[];

    const result = await comparePlayers(players);

    context.response.body = result;
  });
}
