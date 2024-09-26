import { RouterContext } from "oak";

type SocketUrl = string;

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

  /** Just a function to send som random numbers to a given socket. Used for dev and debug */
  private sendSomething(socket: WebSocket) {
    socket.send(new Date().getMilliseconds().toLocaleString("no-NO"));
  }

  /**
   * Creates web socket and attepts to open connection.
   * Adds web socket to management of all open web sockets.
   * @param context
   * @returns Web socket
   */
  startWebSocketConnection(context: RouterContext<string>) {
    if (!context.isUpgradable) {
      context.throw(400, "Web socket can not be established... :(");
    }
    const socket = context.upgrade();
    let intervalID: number | undefined = undefined;

    socket.onopen = () => {
      console.log("Connected to client ✅");
      intervalID = setInterval(() => this.sendSomething(socket), 2345);
      this.addClient(socket);
    };
    socket.onclose = () => {
      console.log("Closed connection 🛑");
      clearInterval(intervalID);
      this.removeClient(socket);
    };
    socket.onerror = () => {
      console.log("Error on connection ❌");
      socket.close();
    };
    return socket;
  }

  /**
   * Send message to all open web sockets on the server managed by the manager
   */
  broadcastMessage(message: string) {
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}
