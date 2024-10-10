import { Router } from "oak";
import { CreatePlayerPayload, createPlayer, deletePlayer, getPlayer } from "./player.ts";
import { isAuthenticated } from "../auth-service/middleware.ts";
import { WebSocketClientManager } from "../web-socket/web-socket-client-manager.ts";

export function registerPlayerRoutes(api: Router, webSocketClientManager: WebSocketClientManager) {
  /**
   * Get a player by name
   */
  api.get("/player/:name", async (context) => {
    const name = context.params.name;
    const player = await getPlayer(name);
    if (player) {
      context.response.body = player;
    } else {
      context.response.status = 404;
    }
  });

  /**
   * Create a player
   */
  api.post("/player", async (context) => {
    const payload = (await context.request.body.json()) as CreatePlayerPayload;

    if (!payload.name) {
      throw new Error("name is required");
    }

    const player = await createPlayer(payload);
    webSocketClientManager.reloadClients();
    context.response.body = player;
  });

  /**
   * Delete a player
   */
  api.delete("/player/:name", isAuthenticated, async (context) => {
    const name = context.params.name;
    if (!name) {
      throw new Error("name is required");
    }
    const player = getPlayer(name);
    if (!player) {
      context.response.status = 404;
      return;
    }
    await deletePlayer(name);
    webSocketClientManager.reloadClients();
    context.response.status = 204;
  });
}
