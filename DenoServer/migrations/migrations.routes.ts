import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
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
