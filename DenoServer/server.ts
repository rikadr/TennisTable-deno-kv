import { Application, Router } from "oak";
import { oakCors } from "cors";
import { registerUserRoutes } from "./user/user.routes.ts";
import { registerWebSocketRoutes } from "./web-socket/web-socket.routs.ts";
import { WebSocketClientManager } from "./web-socket/web-socket-client-manager.ts";
import { registerEventStoreRoutes } from "./event-store/event-store.routes.ts";
import { registerImageKitRoutes } from "./image-kit/image-kit.routes.ts";
import { registerLiveGameRoutes } from "./live-game/live-game.routes.ts";
import { ROOT_CLIENT, useFixedClient, usePathClient } from "./client.ts";

// Start background services
import "./integrations/gamebot/poller.ts";

const app = new Application();

app.use(
  oakCors({
    origin: "*",
    allowedHeaders: ["content-type", "Authorization"],
    methods: "*",
  }),
);

export const webSocketClientManager = new WebSocketClientManager();

/**
 * Register routes. Every route serves one client, and the client comes first
 * in the path: `/optio/events`.
 */
const routes = new Router();
registerImageKitRoutes(routes);
registerWebSocketRoutes(routes);
registerUserRoutes(routes);

registerEventStoreRoutes(routes);
registerLiveGameRoutes(routes);

const api = new Router();
api.use("/:client", usePathClient, routes.routes(), routes.allowedMethods());
app.use(api.routes());
app.use(api.allowedMethods());

// The routes without a client in the path, for the frontends that still use them
if (ROOT_CLIENT) {
  const root = new Router();
  root.use(useFixedClient(ROOT_CLIENT), routes.routes(), routes.allowedMethods());
  app.use(root.routes());
  app.use(root.allowedMethods());
}

await app.listen({ port: 8000 });
