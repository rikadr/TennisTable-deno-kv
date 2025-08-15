import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { EventType, EventTypeEnum } from "./event-types.ts";
import { getEventsAfter, storeEvent } from "./event-store.ts";
import { webSocketClientManager } from "../server.ts";
import { hasAccess } from "../auth-service/middleware.ts";
import { kv } from "../db.ts";

export function registerEventStoreRoutes(api: Router) {
  /**
   * Get all events
   */
  api.get("/events", async (context) => {
    const events = await getEventsAfter(0);
    context.response.body = events;
  });

  /**
   * Stores a new event
   */
  api.post("/event", async (context) => {
    const eventPayload = (await context.request.body.json()) as EventType;

    // Assume frontend has validated business logic for the event // TODO: Do reducer business logic backend too
    // Run zod validation??

    if (eventPayload.type === EventTypeEnum.PLAYER_DEACTIVATED) {
      if ((await hasAccess(context, "player", "deactivate")) === false) {
        context.response.status = 403;
        return;
      }
    }
    if (eventPayload.type === EventTypeEnum.PLAYER_REACTIVATED) {
      if ((await hasAccess(context, "player", "reactivate")) === false) {
        context.response.status = 403;
        return;
      }
    }
    if (eventPayload.type === EventTypeEnum.PLAYER_NAME_UPDATED) {
      if ((await hasAccess(context, "player", "update")) === false) {
        context.response.status = 403;
        return;
      }
    }
    if (eventPayload.type === EventTypeEnum.GAME_DELETED) {
      if ((await hasAccess(context, "game", "delete")) === false) {
        context.response.status = 403;
        return;
      }
    }

    await storeEvent(eventPayload);
    webSocketClientManager.broadcastLatestEvent();
    context.response.status = 201;
  });

  /**
   * DEBUG AND DEV ONLY: Do not register the following routes in production
   */
  const environment = Deno.env.get("ENVIRONMENT");
  if (environment !== "local") {
    return;
  }

  console.log("******** Registering debug routes for event store");

  /**
   * Stores multiple new events
   */
  api.post("/events", async (context) => {
    const eventsPayload = (await context.request.body.json()) as EventType[];

    for (const event of eventsPayload) {
      await storeEvent(event);
    }
    webSocketClientManager.broadcastLatestEvent();

    context.response.body = { uploadedCount: eventsPayload.length.toLocaleString() };
    context.response.status = 201;
  });

  /**
   * Delete all events
   */
  api.delete("/events", async (context) => {
    let deletedCount = 0;

    const events = kv.list<EventType>({ prefix: ["event"] });
    for await (const event of events) {
      await kv.delete(event.key);
      deletedCount++;
    }
    webSocketClientManager.broadcastLatestEvent();

    console.log(`Deleted ${deletedCount.toLocaleString()} events`);
    context.response.status = 204;
  });
}
