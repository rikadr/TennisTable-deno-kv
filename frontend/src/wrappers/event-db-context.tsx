import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { httpClient } from "../common/http-client";
import { createContext, useContext } from "react";
import { TennisTable } from "../client/client-db/tennis-table";
import { EventType } from "../client/client-db/event-store/event-types";
import { ClientDbDTO } from "../client/client-db/types";
import { getClientConfig } from "../client/client-config/get-client-config";

function useEventDb() {
  return useQuery<EventType[]>({
    queryKey: ["event-db"],
    queryFn: async () => {
      const url = new URL(`${process.env.REACT_APP_API_BASE_URL}/events`);
      return httpClient(url, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<EventType[]>);
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
  });
}

function useClientDb() {
  return useQuery<ClientDbDTO>({
    queryKey: ["client-db"],
    queryFn: async () => {
      const url = new URL(`${process.env.REACT_APP_API_BASE_URL}/client-db`);
      return httpClient(url, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<ClientDbDTO>);
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

export const EventDbContext = createContext<TennisTable>(new TennisTable({ games: [], players: [], events: [] }));

export const useEventDbContext = () => useContext(EventDbContext);

export const EventDbWrapper: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const eventsQuery = useEventDb();
  const clientQuery = useClientDb();
  const client = getClientConfig();

  if (eventsQuery.isLoading || clientQuery.isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="animate-ping w-fit text-9xl pr-4">{client.favicon}</div>
      </div>
    );
  }
  if (eventsQuery.isError || clientQuery.isError) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <section>
          <p>An error occured when loading events. Please try again</p>
          <p>Error message: {eventsQuery.error?.message}</p>
        </section>
      </div>
    );
  }
  if (!eventsQuery.data || !clientQuery.data) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p>Unable to load events. Please try again</p>
      </div>
    );
  }
  const tennistableClass = (window.tennisTable = new TennisTable({
    players: clientQuery.data.players,
    games: clientQuery.data.games,
    tournament: clientQuery.data.tournament,
    events: eventsQuery.data,
  }));

  return <EventDbContext.Provider value={tennistableClass}>{children}</EventDbContext.Provider>;
};
