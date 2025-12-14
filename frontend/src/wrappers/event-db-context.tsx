import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { httpClient } from "../common/http-client";
import { createContext, useContext } from "react";
import { TennisTable } from "../client/client-db/tennis-table";
import { EventType } from "../client/client-db/event-store/event-types";
import { PingPongLoader } from "../common/ping-loader";

export function useEventDb() {
  return useQuery<EventType[]>({
    queryKey: ["event-db"],
    queryFn: async () => {
      const LOCAL_STORAGE_KEY = "tennis-table-events";
      const CACHE_TIMESTAMP_KEY = "tennis-table-events-cache-time";
      const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
      const FORCE_INVALIDATE_BEFORE = new Date("2025-12-15T00:00:00").getTime();

      let storedEvents: EventType[] = [];
      let shouldClearCache = false;

      try {
        const storedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
        const cachedAt = storedTimestamp ? parseInt(storedTimestamp, 10) : undefined;
        const now = Date.now();

        // 1. Check if cache is missing timestamp or too old (undefined or < FORCE_INVALIDATE_BEFORE)
        if (cachedAt === undefined || cachedAt < FORCE_INVALIDATE_BEFORE) {
            shouldClearCache = true;
        } 
        // 2. Check TTL (7 days)
        else if (now - cachedAt > TTL_MS) {
            shouldClearCache = true;
        }

        if (shouldClearCache) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            localStorage.removeItem(CACHE_TIMESTAMP_KEY);
        } else {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (stored) {
                storedEvents = JSON.parse(stored);
            }
        }
      } catch (e) {
        console.error("Failed to parse stored events or timestamp", e);
        // If parsing fails, safer to clear
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem(CACHE_TIMESTAMP_KEY);
        storedEvents = [];
      }

      const lastEventTime = storedEvents.length > 0 ? storedEvents[storedEvents.length - 1].time : 0;
      const url = new URL(`${process.env.REACT_APP_API_BASE_URL}/events`);
      url.searchParams.append("after", lastEventTime.toString());

      const newEvents = await httpClient(url, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<EventType[]>);

      const allEvents = [...storedEvents, ...newEvents];
      
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allEvents));
        
        // Only update the cache timestamp if we performed a full fetch (from scratch).
        // This ensures the TTL counts from when the full dataset was properly established,
        // not just when we last appended a few events.
        if (storedEvents.length === 0) {
            localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        }
      } catch (e) {
        console.error("Failed to save events to local storage", e);
      }

      return allEvents;
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
  });
}

declare global {
  interface Window {
    tennisTable: TennisTable;
  }
}

export const EventDbContext = createContext<TennisTable>(new TennisTable({ events: [] }));
export const useEventDbContext = () => useContext(EventDbContext);

export const EventDbWrapper: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const eventsQuery = useEventDb();

  if (eventsQuery.isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-primary-background">
        <PingPongLoader />
      </div>
    );
  }
  if (eventsQuery.isError) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <section>
          <p>An error occured when loading events. Please try again</p>
          <p>Error message: {eventsQuery.error?.message}</p>
        </section>
      </div>
    );
  }
  if (!eventsQuery.data) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p>Unable to load events. Please try again</p>
      </div>
    );
  }

  const tennistableClass = (window.tennisTable = new TennisTable({ events: eventsQuery.data }));
  return <EventDbContext.Provider value={tennistableClass}>{children}</EventDbContext.Provider>;
};
