import { EventType, EventTypeEnum } from "./event-types";

/** The events that make up the app state at a point in time.
 * Games count by when they were played, everything else by event time. */
export function eventsUpTo(events: EventType[], time: number): EventType[] {
  return events.filter((event) => {
    if (event.type === EventTypeEnum.GAME_CREATED) {
      return event.data.playedAt <= time;
    }
    return event.time <= time;
  });
}
