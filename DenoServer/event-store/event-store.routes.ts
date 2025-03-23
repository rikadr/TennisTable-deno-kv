import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";
import { EventType } from "./event-types.ts";
import { getEventsAfter, storeEvent } from "./event-store.ts";
import { webSocketClientManager } from "../server.ts";

export function registerEventStoreRoutes(api: Router) {
  /**
   * Stores new event
   */
  api.post("/event", async (context) => {
    const eventPayload = (await context.request.body.json()) as EventType;

    // Assume frontend has validated business logic for the event
    // Run zod validation??

    await storeEvent(eventPayload);

    // Add to event cache (cache must have some key for storing what the latest event is)
    // Send new event to clients
    await webSocketClientManager.reloadCacheAndClients(); // TODO: replace with event cache when implemented
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
    context.response.status = 201;
  });

  /**
   * Get all events
   */
  api.get("/events", async (context) => {
    const events = await getEventsAfter(0);
    context.response.body = events;
  });

  /**
   * Get all events after a certain time
   */
  api.get("/events-after", async (context) => {
    const time = Number(context.request.url.searchParams.get("time"));
    if (typeof time !== "number") {
      context.response.status = 400;
      return;
    }
    const events = await getEventsAfter(time);
    context.response.body = events;
  });
}
