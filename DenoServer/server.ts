import { Application, Router } from "oak";
import { oakCors } from "cors";
import { registerPlayerRoutes } from "./player/player.routes.ts";
import { registerGameRoutes } from "./game/game.routes.ts";
import { registerUserRoutes } from "./user/user.routes.ts";
import { registerWebSocketRoutes } from "./web-socket/web-socket.routs.ts";
import { WebSocketClientManager } from "./web-socket/web-socket-client-manager.ts";
import { registerClientDbRoutes } from "./client-db/client-db.routes.ts";

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
registerPlayerRoutes(api, webSocketClientManager);
registerGameRoutes(api, webSocketClientManager);
registerWebSocketRoutes(api, webSocketClientManager);
registerClientDbRoutes(api);

registerUserRoutes(api);
app.use(api.routes());
app.use(api.allowedMethods());

// Define a function to handle cleanup tasks on shutdown
function shutdown() {
  console.log("Shutting down the server...");
  webSocketClientManager.closeAllConnections();
  console.log("Cleanup complete. Server is now shutting down.");
  Deno.exit();
}

// Listen for termination signals and call the shutdown function
Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

await app.listen({ port: 8000 });
