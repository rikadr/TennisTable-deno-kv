import { RouterContext } from "oak";

/**
 * Defined messages that can be broadcast to connected clients
 */
enum WS_BROADCAST {
  RELOAD = "reload",
}

export class WebSocketClientManager {
  clients: Set<WebSocket>;
  constructor() {
    this.clients = new Set();
  }

  private addClient(socket: WebSocket) {
    this.clients.add(socket);
  }
  private removeClient(socket: WebSocket) {
    this.clients.delete(socket);
  }
  /**
   * Send message to all open web sockets on the server managed by the manager
   */
  private broadcastMessage(message: WS_BROADCAST) {
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  /**
   * Creates web socket and attepts to open connection.
   * Adds web socket to management of all open web sockets.
   * @param context
   * @returns Web socket
   */
  startWebSocketConnection(context: RouterContext<string>) {
    if (!context.isUpgradable) {
      context.throw(400, "Request can not be upgraded to a web socket");
    }
    const socket = context.upgrade();

    socket.onopen = () => {
      console.log("Connected to client ✅");
      this.addClient(socket);
    };
    socket.onclose = () => {
      console.log("Closed connection 🛑");
      this.removeClient(socket);
    };
    socket.onerror = () => {
      console.log("Error on connection ❌");
      socket.close();
    };
    return socket;
  }

  /**
   * Broadcast all connected clients a request to reload data their data.
   * Used for when games or player data is changed or updated.
   */
  reloadClients() {
    this.broadcastMessage(WS_BROADCAST.RELOAD);
  }
}
