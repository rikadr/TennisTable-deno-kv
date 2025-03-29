import { RouterContext } from "oak";

/**
 * Defined messages that can be broadcast to connected clients
 */
enum WS_MESSAGE {
  RELOAD = "reload",
  CONNECTION_ID = "connection-id",
  HEART_BEAT = "heart-beat",
  // NEW_EVENT = "new-event", // TODO
  // REQUEST_ALL_NEW_EVENTS = "request-all-new-events", // TODO
}

export class WebSocketClientManager {
  private readonly instanciatedAt = Date.now();
  private clients: Map<string, { client: WebSocket; createdAt: number }>;

  constructor() {
    this.clients = new Map();
  }

  private addClient(client: WebSocket): string {
    const connectionId = Math.random().toString(36).substring(2);
    this.clients.set(connectionId, { client, createdAt: Date.now() });
    return connectionId;
  }

  private removeClient(connectionId: string) {
    const client = this.clients.get(connectionId);
    if (!client) {
      return;
    }
    this.clients.delete(connectionId);
  }

  private clientExists(connectionId: string): boolean {
    return this.clients.has(connectionId);
  }

  private handleMessage(message: unknown, client: WebSocket) {
    if (typeof message !== "string") {
      return;
    }

    if (message.startsWith(WS_MESSAGE.HEART_BEAT)) {
      const connectionId = message.split(":")[1];
      if (this.clientExists(connectionId) === false) {
        client.close();
      }
    }
  }

  /**
   * Send internal connection id to client
   */
  private sendConnectionId(connectionId: string) {
    const client = this.clients.get(connectionId);
    if (client) {
      client.client.send(WS_MESSAGE.CONNECTION_ID + ":" + connectionId);
    }
    //
  }
  /**
   * Send message to all open web sockets on the server managed by the manager
   */
  private broadcastMessage(message: WS_MESSAGE) {
    for (const [_id, client] of this.clients) {
      if (client.client.readyState === WebSocket.OPEN) {
        client.client.send(message);
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

    socket.onmessage = ({ data: message }) => {
      this.handleMessage(message, socket);
    };

    socket.onclose = () => {
      console.log("Closed connection", connectionId);
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
    this.broadcastMessage(WS_MESSAGE.RELOAD);
  }

  /**
   * List all clients and their current state
   */
  listAllClients(): {
    instanciatedAt: string;
    clients: { id: string; createdAt: number }[];
  } {
    return {
      instanciatedAt: new Date(this.instanciatedAt).toLocaleString("no-NO", { hourCycle: "h23" }),
      clients: Array.from(this.clients.keys()).map((id) => ({
        id,
        createdAt: this.clients.get(id)!.createdAt,
      })),
    };
  }
}
