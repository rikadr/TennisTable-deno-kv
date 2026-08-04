import { RouterContext } from "oak";
import { getLatestEventTimestamp } from "../event-store/event-store.ts";

/**
 * Defined messages that can be broadcast to connected clients
 */
enum WS_MESSAGE {
  CONNECTION_ID = "connection-id",
  HEART_BEAT = "heart-beat",
  LATEST_EVENT = "latest-event",
  LIVE_GAME = "live-game",
  CLEAR_CACHE = "clear-cache",
}

/**
 * Name of the cross-instance channel. All server instances of a deployment
 * join the same channel, so a broadcast reaches every connected client and not
 * only the clients that share an instance with the writer.
 */
const FANOUT_CHANNEL_NAME = "ws-updates-fanout";

export class WebSocketClientManager {
  private readonly instanciatedAt = Date.now();
  private clients: Map<string, { client: WebSocket; createdAt: number }>;
  /**
   * The web socket clients live in the memory of one server instance, but the
   * deployment runs several instances. A write can land on an instance that
   * holds no web sockets, so the broadcast must travel between the instances
   * before it goes to the clients.
   *
   * `BroadcastChannel` does this on Deno Deploy. It is undefined on a local
   * server without the unstable flag, and then the fanout is a no-op. One
   * local instance holds all the clients, so the local behaviour stays correct.
   */
  private fanout: BroadcastChannel | undefined;

  constructor() {
    this.clients = new Map();
    this.fanout = this.openFanoutChannel();
  }

  private openFanoutChannel(): BroadcastChannel | undefined {
    if (typeof BroadcastChannel === "undefined") {
      console.log("BroadcastChannel is not available. Web socket broadcasts stay local to this instance.");
      return undefined;
    }

    try {
      const channel = new BroadcastChannel(FANOUT_CHANNEL_NAME);
      // A message from another instance goes to this instance's clients only.
      // Sending it back to the channel would loop between the instances.
      channel.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data === "string") {
          this.sendToLocalClients(event.data);
        }
      };
      return channel;
    } catch (error) {
      console.error("Failed to open the web socket fanout channel:", error);
      return undefined;
    }
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
        return;
      }
      client.send(WS_MESSAGE.HEART_BEAT + ":" + connectionId);
      return;
    }

    if (message.startsWith(WS_MESSAGE.LATEST_EVENT)) {
      this.sendLatestEvent(client);
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
  }

  /**
   * Send latest event id to the client
   */
  private sendLatestEventFromConnectionId(connectionId: string) {
    const client = this.clients.get(connectionId);
    if (!client) return;

    this.sendLatestEvent(client.client);
  }

  private async sendLatestEvent(client: WebSocket) {
    // A database read can fail. It runs outside of a request, so a rejection
    // here is unhandled and stops the process with all of its web sockets.
    try {
      const lastEvent = await getLatestEventTimestamp();
      if (!lastEvent) return;

      if (client.readyState === WebSocket.OPEN) {
        client.send(WS_MESSAGE.LATEST_EVENT + ":" + lastEvent);
      }
    } catch (error) {
      console.error("Failed to send the latest event to a client:", error);
    }
  }

  /**
   * Send message to all open web sockets of this server instance
   */
  private sendToLocalClients(message: string) {
    for (const [_id, client] of this.clients) {
      if (client.client.readyState === WebSocket.OPEN) {
        client.client.send(message);
      }
    }
  }

  /**
   * Send message to all open web sockets of all server instances
   */
  private broadcastMessage(message: string) {
    this.sendToLocalClients(message);

    try {
      this.fanout?.postMessage(message);
    } catch (error) {
      console.error("Failed to send a web socket broadcast to the other instances:", error);
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
      this.sendLatestEventFromConnectionId(id);
    };

    socket.onmessage = ({ data: message }) => {
      this.handleMessage(message, socket);
    };

    socket.onclose = () => {
      // console.log("Closed connection", connectionId);
      this.removeClient(connectionId);
    };

    socket.onerror = () => {
      // console.log("❌ Error on connection", connectionId);
      socket.close();
    };
    return socket;
  }

  /**
   * Broadcast all connected clients a request to check if they need to reload their data.
   * Used for when new events are added.
   */
  async broadcastLatestEvent() {
    // Callers do not await this, so a rejection would be unhandled.
    try {
      const lastEvent = await getLatestEventTimestamp();
      if (!lastEvent) return;
      this.broadcastMessage(WS_MESSAGE.LATEST_EVENT + ":" + lastEvent);
    } catch (error) {
      console.error("Failed to broadcast the latest event:", error);
    }
  }

  /**
   * Tell all clients to clear their local storage event cache and refetch the
   * full event history. Only for event manipulation (edit/delete), where
   * already-cached events have changed... dont use this if you can avoid it
   */
  broadcastClearCache() {
    this.broadcastMessage(WS_MESSAGE.CLEAR_CACHE);
  }

  /**
   * Notify all clients that the live game state has changed.
   * Clients should refetch `/live-game` to get the new state.
   */
  broadcastLiveGame() {
    this.broadcastMessage(WS_MESSAGE.LIVE_GAME);
  }

  /**
   * List all clients and their current state
   */
  listAllClients(): {
    instanciatedAt: string;
    crossInstanceFanout: boolean;
    clients: { id: string; createdAt: number }[];
  } {
    return {
      instanciatedAt: new Date(this.instanciatedAt).toLocaleString("no-NO", { hourCycle: "h23" }),
      // The list covers one server instance. A deployment runs several, so two
      // calls can report different instances and different client lists.
      crossInstanceFanout: this.fanout !== undefined,
      clients: Array.from(this.clients.keys()).map((id) => ({
        id,
        createdAt: this.clients.get(id)!.createdAt,
      })),
    };
  }
}
