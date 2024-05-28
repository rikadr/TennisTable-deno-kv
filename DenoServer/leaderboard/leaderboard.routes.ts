import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { getLeaderboard, getPlayerSummary } from "./leaderboard.ts";

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
}
