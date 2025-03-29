import { Application, Router } from "oak";
import { oakCors } from "cors";
import { registerPlayerRoutes } from "./player/player.routes.ts";
import { registerGameRoutes } from "./game/game.routes.ts";
import { registerUserRoutes } from "./user/user.routes.ts";
import { registerWebSocketRoutes } from "./web-socket/web-socket.routs.ts";
import { WebSocketClientManager } from "./web-socket/web-socket-client-manager.ts";
import { registerEventStoreRoutes } from "./event-store/event-store.routes.ts";
import { registerMigrationsRoutes } from "./migrations/migrations.routes.ts";
import { EventCache } from "./event-store/event-cache.ts";
import { runMigrations } from "./migrations/index.ts";

const app = new Application();
const api = new Router();

app.use(
  oakCors({
    origin: "*",
    allowedHeaders: ["content-type", "Authorization"],
    methods: "*",
  }),
);

export const eventCache = new EventCache();
export const webSocketClientManager = new WebSocketClientManager();

/**
 * Run database migrations
 */
await runMigrations();
registerMigrationsRoutes(api);

/**
 * Register routes
 */
registerPlayerRoutes(api);
registerGameRoutes(api);
registerWebSocketRoutes(api);
registerUserRoutes(api);

registerEventStoreRoutes(api);

app.use(api.routes());
app.use(api.allowedMethods());

await app.listen({ port: 8000 });
