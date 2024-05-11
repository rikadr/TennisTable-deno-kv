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
      {tableQuery.data && <TennisTable gameTable={tableQuery.data} />}
    </div>
  );
};
