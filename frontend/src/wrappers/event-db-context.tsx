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
      let storedEvents: EventType[] = [];
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          storedEvents = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Failed to parse stored events", e);
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
