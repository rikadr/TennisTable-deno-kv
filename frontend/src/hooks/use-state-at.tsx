import { useMemo } from "react";
import { useEventDbContext } from "../wrappers/event-db-context";
import { TennisTable } from "../client/client-db/tennis-table";
import { EventType, EventTypeEnum } from "../client/client-db/event-store/event-types";

// Same "state at a point in time" filter as tournament predictions:
// games count by when they were played, everything else by event time.
export function eventsUpTo(events: EventType[], time: number): EventType[] {
  return events.filter((event) => {
    if (event.type === EventTypeEnum.GAME_CREATED) {
      return event.data.playedAt <= time;
    }
    return event.time <= time;
  });
}

// The full app state projected at a point in time.
export function useStateAt(time: number | undefined): TennisTable | undefined {
  const context = useEventDbContext();
  return useMemo(() => {
    if (time === undefined) return undefined;
    return new TennisTable({ events: eventsUpTo(context.events, time), referenceTime: time });
  }, [context, time]);
}
