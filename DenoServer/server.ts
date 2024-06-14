import { Application, Router } from "oak";
import { oakCors } from "cors";
import { registerPlayerRoutes } from "./player/player.routes.ts";
import { registerGameRoutes } from "./game/game.routes.ts";
import { registerEloRoutes } from "./elo/elo.routes.ts";
import { registerLeaderboardRoutes } from "./leaderboard/leaderboard.routes.ts";
import { registerUserRoutes } from "./user/user.routes.ts";

const app = new Application();
const api = new Router();

app.use(
  oakCors({
    origin: "*",
    allowedHeaders: "*",
    methods: "*",
  }),
);

/**
 * Register routes
 */
registerPlayerRoutes(api);
registerGameRoutes(api);
registerEloRoutes(api);
registerLeaderboardRoutes(api);

registerUserRoutes(api);
app.use(api.routes());
app.use(api.allowedMethods());

await app.listen({ port: 8000 });
