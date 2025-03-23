import { Application, Router } from "oak";
import { oakCors } from "cors";
import { registerPlayerRoutes } from "./player/player.routes.ts";
import { registerGameRoutes } from "./game/game.routes.ts";
import { registerUserRoutes } from "./user/user.routes.ts";
import { registerWebSocketRoutes } from "./web-socket/web-socket.routs.ts";
import { WebSocketClientManager } from "./web-socket/web-socket-client-manager.ts";
import { registerClientDbRoutes } from "./client-db/client-db.routes.ts";
import { registerTournamentRoutes } from "./tournament/tournament.routes.ts";
import { ClientDBCacheManager } from "./client-db/client-db-cache.ts";
import { runMigrations } from "./migrations/index.ts";
import { registerEventStoreRoutes } from "./event-store/event-store.routes.ts";

const app = new Application();
const api = new Router();

app.use(
  oakCors({
    origin: "*",
    allowedHeaders: ["content-type", "Authorization"],
    methods: "*",
  }),
);

export const clientDBCacheManager = new ClientDBCacheManager();
export const webSocketClientManager = new WebSocketClientManager();

/**
 * Run database migrations
 */
await runMigrations();

/**
 * Register routes
 */
registerPlayerRoutes(api);
registerGameRoutes(api);
registerTournamentRoutes(api);
registerWebSocketRoutes(api);
registerClientDbRoutes(api);
registerUserRoutes(api);

registerEventStoreRoutes(api);

app.use(api.routes());
app.use(api.allowedMethods());

await app.listen({ port: 8000 });
