import { Router } from "oak";
import { hasAccess } from "../auth-service/middleware.ts";
import { clearLiveGame, getLiveGame, LiveGameState, setLiveGame } from "./live-game.ts";
import { webSocketClientManager } from "../server.ts";
import { clientOf } from "../client.ts";

export function registerLiveGameRoutes(api: Router) {
  api.get("/live-game", async (context) => {
    const state = await getLiveGame(clientOf(context));
    context.response.body = state;
  });

  api.put("/live-game", async (context) => {
    if ((await hasAccess(context, "live-game", "update")) === false) {
      context.response.status = 403;
      return;
    }

    const payload = (await context.request.body.json()) as LiveGameState;
    const updated: LiveGameState = { ...payload, updatedAt: Date.now() };
    const client = clientOf(context);
    await setLiveGame(client, updated);
    webSocketClientManager.broadcastLiveGame(client);
    context.response.status = 200;
    context.response.body = updated;
  });

  api.delete("/live-game", async (context) => {
    if ((await hasAccess(context, "live-game", "update")) === false) {
      context.response.status = 403;
      return;
    }

    const client = clientOf(context);
    await clearLiveGame(client);
    webSocketClientManager.broadcastLiveGame(client);
    context.response.status = 204;
  });
}
