import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LeaderBoard } from "./leader-board";
export type GameTableDTO = {
  players: GameTablePlayer[];
};
export type GameTablePlayer = {
  name: string;
  elo: number;
  wins: { oponent: string; count: number }[];
  loss: { oponent: string; count: number }[];
};

export const LeaderBoardPage: React.FC = () => {
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
    <div className="flex flex-col items-center">
      <section className="flex gap-x-4 gap-y-2 items-baseline flex-col w-56 sm:w-fit sm:flex-row p-1">
        <h1 className="whitespace-nowrap">Tennis🏆💔Table</h1>
        <Link
          className="w-full text-sm text-center whitespace-nowrap bg-green-700 hover:bg-green-900 text-white py-1 px-3 rounded-md font-thin"
          to="/add-game"
        >
          Add played game +🏓
        </Link>
        <Link
          className="w-full text-sm text-center whitespace-nowrap bg-green-700 hover:bg-green-900 text-white py-1 px-3 rounded-md font-thin"
          to="/add-player"
        >
          Add player +👤
        </Link>
        <Link
          className="w-full text-sm text-center whitespace-nowrap ring-[0.5px] font-thin ring-white text-white px-1 rounded-md"
          to="/admin"
        >
          To admin page 🔐
        </Link>
      </section>
      {(tableQuery.isLoading || tableQuery.isFetching) && (
        <div className="grid grid-cols-1 gap-1 grid-flow-row w-full">
          {Array.from({ length: 6 }, () => "").map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-lg bg-gray-500"
            />
          ))}
        </div>
      )}
      {tableQuery.data && !tableQuery.isLoading && !tableQuery.isFetching && (
        <LeaderBoard gameTable={tableQuery.data} />
      )}
    </div>
  );
};