import { Router } from "oak";
import { runMigrations } from "./index.ts";

export function registerMigrationsRoutes(api: Router) {
  /**
   * Perform all migrations
   */
  api.get("/migrate", async (context) => {
    await runMigrations();
    context.response.body = { message: "Migrations complete" };
  });
}
