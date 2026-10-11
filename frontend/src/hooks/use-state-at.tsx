import { useMemo } from "react";
import { useEventDbContext } from "../wrappers/event-db-context";
import { TennisTable } from "../client/client-db/tennis-table";
import { eventsUpTo } from "../client/client-db/event-store/events-up-to";
import { useAchievementsSnapshot } from "./use-achievements-snapshot";

export { eventsUpTo };

// The full app state projected at a point in time. With `achievements`, a web
// worker calculates the achievements of that time, and the state has them when
// `state.achievements.isReady` is true. Without it, the state has no achievements.
export function useStateAt(time: number | undefined, options?: { achievements?: boolean }): TennisTable | undefined {
  const context = useEventDbContext();
  const events = useMemo(
    () => (time === undefined ? undefined : eventsUpTo(context.events, time)),
    [context.events, time],
  );
  const { snapshot, isCurrent } = useAchievementsSnapshot(options?.achievements ? events : undefined, time);
  const currentSnapshot = isCurrent ? snapshot : undefined;

  return useMemo(() => {
    if (events === undefined) return undefined;
    return new TennisTable({ events, referenceTime: time, achievements: currentSnapshot ?? "pending" });
  }, [events, time, currentSnapshot]);
}
