import { Application, Router } from "https://deno.land/x/oak@v16.0.0/mod.ts";
import { registerPlayerRoutes } from "./player/player.routes.ts";
import { registerGameRoutes } from "./game/game.routes.ts";

const app = new Application();
const api = new Router();

/**
 * Register routs
 */
registerPlayerRoutes(api);
registerGameRoutes(api);

app.use(api.routes());
app.use(api.allowedMethods());

await app.listen({ port: 8000 });
