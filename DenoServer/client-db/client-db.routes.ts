import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { clientDBCacheManager } from "../server.ts";
import { getClientDbData } from "./client-db.ts";

// -----------------------------------------------------------------------------------------------
//  Client side "database". This is a simple in-memory database/data storage that is used to store
//  all the data you need to run the client side of the application.
// -----------------------------------------------------------------------------------------------

export function registerClientDbRoutes(api: Router) {
  /**
   * Get client db data
   */
  api.get("/client-db", async (context) => {
    const cache = await clientDBCacheManager.getCache();
    if (cache) {
      context.response.body = cache;
      return;
    }

    const response = await getClientDbData();
    await clientDBCacheManager.setCache(response);
    context.response.body = response;
  });
}
