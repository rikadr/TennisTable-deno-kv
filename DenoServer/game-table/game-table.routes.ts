import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { getGameTable } from "./game-table.ts";

export function registerGameTableRoutes(api: Router) {
  /**
   * Get current game table
   */
  api.get("/game-table", async (context) => {
    const gameTable = await getGameTable();

    context.response.body = gameTable;
  });
}
