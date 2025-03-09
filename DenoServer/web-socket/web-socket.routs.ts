import { Router, RouterContext } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { webSocketClientManager } from "../server.ts";

export function registerWebSocketRoutes(api: Router) {
  /**
   * Establish a web socket connection
   */
  api.get("/ws-updates", (context) => {
    webSocketClientManager.startWebSocketConnection(context as RouterContext<string>); // Temp casting
  });

  /**
   * List all connected clients' web sockets managed in client manager
   */
  api.get("/ws-list", (context) => {
    const clientList = webSocketClientManager.listAllClients();
    context.response.body = clientList;
  });
}
