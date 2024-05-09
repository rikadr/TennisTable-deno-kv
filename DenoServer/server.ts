import { Application, Router } from "https://deno.land/x/oak@v16.0.0/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { registerPlayerRoutes } from "./player/player.routes.ts";
import { registerGameRoutes } from "./game/game.routes.ts";
import { registerEloRoutes } from "./elo/elo.routes.ts";

const app = new Application();
const api = new Router();

/**
 * Register routs
 */
registerPlayerRoutes(api);
registerGameRoutes(api);
registerEloRoutes(api);

api.get("/", (context) => context.response.redirect("/players"));

app.use(oakCors({ origin: "*" }));
app.use(api.routes());
app.use(api.allowedMethods());

await app.listen({ port: 8000 });