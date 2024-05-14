import React from "react";
import { TennisTable } from "./tennis-table";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
        <button
          className="text-sm bg-green-700 hover:bg-green-900 text-white px-1 rounded-md font-thin"
          onClick={() => console.log("Add player clicked")}
        >
          Add player +
        </button>
        <Link
          className="text-sm ring-[0.5px] font-thin ring-white text-white px-1 rounded-md"
          to="/admin"
        >
          To admin page 🔐
        </Link>
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
