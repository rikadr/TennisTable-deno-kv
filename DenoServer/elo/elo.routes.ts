import { Router } from "oak";
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
