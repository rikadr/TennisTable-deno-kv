import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { getLeaderboard } from "./leaderboard.ts";

export function registerLeaderboardRoutes(api: Router) {
  /**
   * Get current leaderboard
   */
  api.get("/leaderboard", async (context) => {
    const leaderboard = await getLeaderboard();
    context.response.body = leaderboard;
  });
}
