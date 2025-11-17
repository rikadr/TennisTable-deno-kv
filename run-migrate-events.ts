import { optioEvents } from "./events-dump-optio.ts";
import { updateEventTimes } from "./migrate-event-times.ts";

const updatedEvents = updateEventTimes(optioEvents);

await Deno.writeTextFile("updated-events.txt", JSON.stringify(updatedEvents));
console.log(`Successfully wrote ${updatedEvents.length} events to updated-events.txt`);
