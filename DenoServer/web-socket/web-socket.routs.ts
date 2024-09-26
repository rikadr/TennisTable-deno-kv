import { Router, RouterContext } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { WebSocketClientManager } from "./web-socket-client-manager.ts";

export function registerWebSocketRoutes(api: Router, clientManager: WebSocketClientManager) {
  /**
   * Establish a web socket connection
   */
  api.get("/ws", (context) => {
    const socket = clientManager.startWebSocketConnection(context as RouterContext<string>); // Temp casting
    socket.onmessage = (messageEvent) => {
      console.log("Message from client:", messageEvent.data);
      socket.send("Server got the message: '" + messageEvent.data + "'");
    };
  });
}
