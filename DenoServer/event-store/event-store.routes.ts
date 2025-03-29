import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { EventType } from "./event-types.ts";
import { storeEvent } from "./event-store.ts";
import { eventCache, webSocketClientManager } from "../server.ts";

export function registerEventStoreRoutes(api: Router) {
  /**
   * Stores new event
   */
  api.post("/event", async (context) => {
    const eventPayload = (await context.request.body.json()) as EventType;

    // Assume frontend has validated business logic for the event // TODO: Do reducer business logic backend too
    // Run zod validation??
    // Run authz validation for delete game and deactivate/reactivate players
    // api.delete("/games", isAuthenticated, requireAuth("game", "delete"), async (context) => {

    await storeEvent(eventPayload);

    await eventCache.appendEventsToEventCache([eventPayload]);
    webSocketClientManager.reloadClients();
    context.response.status = 201;
  });

  /**
   * DEBUG AND DEV ONLY: Stores multiple new events
   */
  api.post("/events", async (context) => {
    const eventsPayload = (await context.request.body.json()) as EventType[];

    for (const event of eventsPayload) {
      await storeEvent(event);
    }
    await eventCache.appendEventsToEventCache(eventsPayload);
    webSocketClientManager.reloadClients();
    context.response.status = 201;
  });

  /**
   * Get all events
   */
  api.get("/events", async (context) => {
    const eventData = await eventCache.getEventData();
    context.response.body = eventData.events;
  });
}
