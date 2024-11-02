import { RouterContext } from "oak";

/**
 * Defined messages that can be broadcast to connected clients
 */
enum WS_BROADCAST {
  RELOAD = "reload",
  CONNECTION_ID = "connection-id",
}

export class WebSocketClientManager {
  private clients: Map<string, { client: WebSocket; createdAt: number; broadcastsReceived: number }>;

  constructor() {
    this.clients = new Map();
  }

  private addClient(client: WebSocket): string {
    const connectionId = Math.random().toString(36).substring(2);
    this.clients.set(connectionId, { client, createdAt: Date.now(), broadcastsReceived: 0 });
    return connectionId;
  }

  private removeClient(connectionId: string) {
    this.clients.delete(connectionId);
  }

  /**
   * Send internal connection id to client
   */
  private sendConnectionId(connectionId: string) {
    const client = this.clients.get(connectionId);
    if (client) {
      client.client.send(WS_BROADCAST.CONNECTION_ID + ":" + connectionId);
    }
    //
  }
  /**
   * Send message to all open web sockets on the server managed by the manager
   */
  private broadcastMessage(message: WS_BROADCAST) {
    for (const [_id, client] of this.clients) {
      if (client.client.readyState === WebSocket.OPEN) {
        client.client.send(message);
        client.broadcastsReceived++;
      }
    }
  }

  /**
   * Upgrades connection and created a web socket.
   * Adds web socket to management of all open web sockets.
   * @param context
   * @returns Web socket
   */
  startWebSocketConnection(context: RouterContext<string>) {
    if (!context.isUpgradable) {
      context.throw(400, "Request can not be upgraded to a web socket");
    }
    const socket = context.upgrade();
    let connectionId = "";

    socket.onopen = () => {
      const id = this.addClient(socket);
      connectionId = id;
      this.sendConnectionId(id);
    };

    socket.onclose = () => {
      this.removeClient(connectionId);
    };

    socket.onerror = () => {
      console.log("❌ Error on connection", connectionId);
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

  /**
   * List all clients and their current state
   */
  listAllClients(): { id: string; createdAt: number; broadcastsReceived: number }[] {
    return Array.from(this.clients.keys()).map((id) => ({
      id,
      createdAt: this.clients.get(id)!.createdAt,
      broadcastsReceived: this.clients.get(id)!.broadcastsReceived,
    }));
  }
}
