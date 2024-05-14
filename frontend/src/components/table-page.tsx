import React from "react";
import { TennisTable } from "./tennis-table";
import { useQuery } from "@tanstack/react-query";
export type GameTableDTO = {
  players: GameTablePlayer[];
};
export type GameTablePlayer = {
  name: string;
  elo: number;
  wins: { oponent: string; count: number }[];
  loss: { oponent: string; count: number }[];
};

export const TablePage: React.FC = () => {
  const tableQuery = useQuery<GameTableDTO>({
    queryKey: ["game-table"],
    queryFn: async () => {
      return fetch(`${process.env.REACT_APP_API_BASE_URL}/game-table`, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<GameTableDTO>);
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  return (
    <div>
      <section className="flex gap-4 items-baseline">
        <h1>Tennis Table</h1>
        <p>Click any cell to register a played game 🏓</p>
      </section>
      {(tableQuery.isLoading || tableQuery.isFetching) && (
        <div className="grid grid-cols-6 gap-1 grid-flow-row w-full">
          {Array.from({ length: 36 }, () => "").map(() => (
            <div className="h-16 animate-pulse rounded-lg bg-gray-500" />
          ))}
        </div>
      )}
      {tableQuery.data && !tableQuery.isLoading && !tableQuery.isFetching && (
        <TennisTable gameTable={tableQuery.data} />
      )}
    </div>
  );
};
