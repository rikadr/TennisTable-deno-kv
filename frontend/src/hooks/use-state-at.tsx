import { useMemo } from "react";
import { useEventDbContext } from "../wrappers/event-db-context";
import { TennisTable } from "../client/client-db/tennis-table";
import { eventsUpTo } from "../client/client-db/event-store/events-up-to";

export { eventsUpTo };

// The full app state projected at a point in time.
export function useStateAt(time: number | undefined): TennisTable | undefined {
  const context = useEventDbContext();
  return useMemo(() => {
    if (time === undefined) return undefined;
    return new TennisTable({ events: eventsUpTo(context.events, time), referenceTime: time });
  }, [context, time]);
}
