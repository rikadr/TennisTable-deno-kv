import { useQuery } from "@tanstack/react-query";
import { GameTableDTO } from "../components/table-page";

export const tableQuery = useQuery<GameTableDTO>({
  queryKey: ["game-table"],
  queryFn: async () => {
    return fetch(`${process.env.REACT_APP_API_BASE_URL}/game-table`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }).then(async (response) => response.json() as Promise<GameTableDTO>);
  },
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
});
