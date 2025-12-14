import { Application, Router } from "oak";
import { oakCors } from "cors";
import { registerUserRoutes } from "./user/user.routes.ts";
import { registerWebSocketRoutes } from "./web-socket/web-socket.routs.ts";
import { WebSocketClientManager } from "./web-socket/web-socket-client-manager.ts";
import { registerEventStoreRoutes } from "./event-store/event-store.routes.ts";
import { registerMigrationsRoutes } from "./migrations/migrations.routes.ts";
import { registerImageKitRoutes } from "./image-kit/image-kit.routes.ts";

// Start background services
import "./integrations/gamebot/poller.ts";

const app = new Application();
const api = new Router();

app.use(
  oakCors({
    origin: "*",
    allowedHeaders: ["content-type", "Authorization"],
    methods: "*",
  }),
);

export const webSocketClientManager = new WebSocketClientManager();

/**
 * Run database migrations
 */
// await runMigrations();
registerMigrationsRoutes(api);

/**
 * Register routes
 */
registerImageKitRoutes(api);
registerWebSocketRoutes(api);
registerUserRoutes(api);

registerEventStoreRoutes(api);

app.use(api.routes());
app.use(api.allowedMethods());

await app.listen({ port: 8000 });
