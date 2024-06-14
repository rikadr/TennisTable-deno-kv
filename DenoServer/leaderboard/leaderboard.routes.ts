import { Router } from "oak";
import { getLeaderboard, getPlayerSummary } from "./leaderboard.ts";
import { comparePlayers } from "./compare-players.ts";

export function registerLeaderboardRoutes(api: Router) {
  /**
   * Get current leaderboard
   */
  api.get("/leaderboard", async (context) => {
    const leaderboard = await getLeaderboard();
    context.response.body = leaderboard;
  });

  /**
   * Get player summary for a specific player
   */
  api.get("/player-summary/:name", async (context) => {
    const name = context.params.name;
    const playerSummary = await getPlayerSummary(name);
    context.response.body = playerSummary;
  });

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
