import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { getAllPlayersELO } from "./elo.ts";

export function registerEloRoutes(api: Router) {
  /**
   * Get all players with ELO s
   */
  api.get("/elo", async (context) => {
    const playersWithElo = await getAllPlayersELO();
    context.response.body = playersWithElo;
  });
}
