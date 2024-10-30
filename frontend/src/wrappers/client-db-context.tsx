import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { httpClient } from "../common/http-client";
import { createContext, useContext } from "react";
import { ClientDbDTO } from "../client-db/types";
import { TennisTable } from "../client-db/tennis-table";

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

export const ClientDbContext = createContext<TennisTable>(new TennisTable({ players: [], games: [] }));

export const useClientDbContext = () => useContext(ClientDbContext);

export const ClientDbWrapper: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const query = useClientDb();

  if (query.isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="animate-ping w-fit text-9xl pr-4">🏓</div>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <section>
          <p>An error occured. Please try again</p>
          <p>Error message: {query.error?.message}</p>
        </section>
      </div>
    );
  }
  if (!query.data) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p>Unable to load data. Please try again</p>
      </div>
    );
  }

  return <ClientDbContext.Provider value={new TennisTable(query.data)}>{children}</ClientDbContext.Provider>;
};
