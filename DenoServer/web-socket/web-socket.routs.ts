import { Router, RouterContext } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { WebSocketClientManager } from "./web-socket-client-manager.ts";

export function registerWebSocketRoutes(api: Router, clientManager: WebSocketClientManager) {
  /**
   * Establish a web socket connection
   */
  api.get("/ws-updates", (context) => {
    clientManager.startWebSocketConnection(context as RouterContext<string>); // Temp casting
  });

  /**
   * List all connected clients' web sockets managed in client manager
   */
  api.get("/ws-list", (context) => {
    const clientList = clientManager.listAllClients();
    context.response.body = clientList;
  });
}
