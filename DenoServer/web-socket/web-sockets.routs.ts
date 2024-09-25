import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";

export function registerWsRoutes(api: Router) {
  /**
   * Establish a WebSocket connection
   */
  api.get("/ws", (context) => {
    if (!context.isUpgradable) {
      context.throw(400, "Web socket can not be established... :(");
    }
    const webSocket = context.upgrade();
    let intervalID: number | undefined = undefined;

    function sendSomething(string?: string) {
      webSocket.send(new Date().getMilliseconds().toLocaleString("no-NO") + (string ?? ""));
    }

    webSocket.onopen = () => {
      console.log("Connected to client!");
      intervalID = setInterval(sendSomething, 1_371);
    };
    webSocket.onmessage = (messageEvent) => {
      console.log("Message from client:", messageEvent.data);
      sendSomething(" From client");
    };
    webSocket.onclose = () => {
      clearInterval(intervalID);
    };
    webSocket.onerror = () => {
      console.log("Error with connection");
    };
  });
}
