import { Application, Router } from "oak";
import { oakCors } from "cors";
import { registerPlayerRoutes } from "./player/player.routes.ts";
import { registerGameRoutes } from "./game/game.routes.ts";
import { registerEloRoutes } from "./elo/elo.routes.ts";
import { registerLeaderboardRoutes } from "./leaderboard/leaderboard.routes.ts";
import { registerUserRoutes } from "./user/user.routes.ts";
import { registerWsRoutes } from "./web-socket/web-socket.routs.ts";
import { WebSocketClientManager } from "./web-socket/web-socket-client-manager.ts";

const app = new Application();
const api = new Router();

app.use(
  oakCors({
    origin: "*",
    allowedHeaders: ["content-type", "Authorization"],
    methods: "*",
  }),
);

const webSocketClientManager = new WebSocketClientManager();

/**
 * Register routes
 */
registerPlayerRoutes(api);
registerGameRoutes(api);
registerEloRoutes(api);
registerLeaderboardRoutes(api);
registerWsRoutes(api, webSocketClientManager);

registerUserRoutes(api);
app.use(api.routes());
app.use(api.allowedMethods());

await app.listen({ port: 8000 });
