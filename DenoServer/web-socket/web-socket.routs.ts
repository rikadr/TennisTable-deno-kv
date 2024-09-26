import { Router, RouterContext } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { WebSocketClientManager } from "./web-socket-client-manager.ts";

export function registerWsRoutes(api: Router, clientManager: WebSocketClientManager) {
  /**
   * Establish a web socket connection
   */
  api.get("/ws", (context) => {
    const socket = clientManager.startWebSocketConnection(context as RouterContext<string>); // Temp casting
    socket.onmessage = (messageEvent) => {
      console.log("Message from client:", messageEvent.data);
      socket.send("Got it...");
    };
  });

  /**
   * Broadcast message to all web sockets
   */
  api.get("/ws/broadcast", (context) => {
    const searchParams = context.request.url.searchParams;
    const message = searchParams.get("message");

    if (typeof message === "string") {
      console.log("Broadcasting message", message);

      clientManager.broadcastMessage(message);
    }
  });
}
