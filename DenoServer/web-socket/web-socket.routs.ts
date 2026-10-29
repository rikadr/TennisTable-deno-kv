import { Router, RouterContext } from "oak";
import { webSocketClientManager } from "../server.ts";
import { clientOf } from "../client.ts";

export function registerWebSocketRoutes(api: Router) {
  /**
   * Establish a web socket connection
   */
  api.get("/ws-updates", (context) => {
    webSocketClientManager.startWebSocketConnection(context as RouterContext<string>, clientOf(context)); // Temp casting
  });

  /**
   * List all connected clients' web sockets managed in client manager
   */
  api.get("/ws-list", (context) => {
    const clientList = webSocketClientManager.listAllClients(clientOf(context));
    context.response.body = clientList;
  });
}
