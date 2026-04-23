import { Router } from "oak";
import { hasAccess } from "../auth-service/middleware.ts";
import { clearLiveGame, getLiveGame, LiveGameState, setLiveGame } from "./live-game.ts";
import { webSocketClientManager } from "../server.ts";

export function registerLiveGameRoutes(api: Router) {
  /**
   * Get the current live game state. Public.
   */
  api.get("/live-game", async (context) => {
    const state = await getLiveGame();
    context.response.body = state;
  });

  /**
   * Update the live game state. Admin only.
   */
  api.put("/live-game", async (context) => {
    if ((await hasAccess(context, "live-game", "update")) === false) {
      context.response.status = 403;
      return;
    }

    const payload = (await context.request.body.json()) as LiveGameState;
    const updated: LiveGameState = { ...payload, updatedAt: Date.now() };
    await setLiveGame(updated);
    webSocketClientManager.broadcastLiveGame();
    context.response.status = 200;
    context.response.body = updated;
  });

  /**
   * Clear the current live game. Admin only.
   */
  api.delete("/live-game", async (context) => {
    if ((await hasAccess(context, "live-game", "update")) === false) {
      context.response.status = 403;
      return;
    }

    await clearLiveGame();
    webSocketClientManager.broadcastLiveGame();
    context.response.status = 204;
  });
}
