import { useQuery } from "@tanstack/react-query";
import { httpClient } from "../common/http-client";
import { createContext, useContext } from "react";

type Player = { name: string };
type Game = { winner: string; loser: string; time: number };
type ClientDbDTO = { players: Player[]; games: Game[] };

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
  });
}

export const ClientDbContext = createContext<ClientDbDTO>({} as ClientDbDTO);

export const useClientDbContext = () => useContext(ClientDbContext);

export const ClientDbWrapper: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const query = useClientDb();

  if (query.isLoading) {
    return <div>Loading...</div>;
  }
  if (query.isError) {
    return <div>Error: {query.error.message}</div>;
  }
  if (!query.data) {
    return <div>Unable to load data</div>;
  }

  return <ClientDbContext.Provider value={query.data}>{children}</ClientDbContext.Provider>;
};
