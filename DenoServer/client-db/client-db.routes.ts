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
    const a = performance.now();
    const cache = await clientDBCacheManager.getCache();
    const b = performance.now();
    if (cache) {
      console.log("CACHE EXIST: Get Cache time", b - a, "total time", b - a);
      context.response.body = cache;
      return;
    }

    const response = await getClientDbData();
    const c = performance.now();
    await clientDBCacheManager.setCache(response);
    const d = performance.now();
    console.log(
      "NO CACHE: Get Cache time",
      b - a,
      "Get data time",
      c - b,
      "Set Cache time",
      d - c,
      "total time",
      d - a,
    );
    context.response.body = response;
  });
}
