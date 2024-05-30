import { useMutation, useQuery } from "@tanstack/react-query";
import React from "react";
import { queryClient } from "../common/query-client";
import { timeAgo } from "../common/date-utils";
import { httpClient } from "./login";

export type PlayersDTO = {
  name: string;
}[];

type GamesDTO = {
  winner: string;
  loser: string;
  time: number;
}[];

export const AdminPage: React.FC = () => {
  const playersQuery = useQuery<PlayersDTO>({
    queryKey: ["all-players"],
    queryFn: async () => {
      return httpClient(`${process.env.REACT_APP_API_BASE_URL}/players`, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<PlayersDTO>);
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const removePlayerMutation = useMutation<unknown, Error, { name: string }, unknown>({
    mutationFn: async ({ name }) => {
      return httpClient(`${process.env.REACT_APP_API_BASE_URL}/player/${name}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const gamesQuery = useQuery<GamesDTO>({
    queryKey: ["all-games"],
    queryFn: async () => {
      return httpClient(`${process.env.REACT_APP_API_BASE_URL}/games`, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<GamesDTO>);
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const deleteGameMutation = useMutation<unknown, Error, { winner: string; loser: string; time: number }, unknown>({
    mutationFn: async ({ winner, loser, time }) => {
      return httpClient(`${process.env.REACT_APP_API_BASE_URL}/game`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          winner,
          loser,
          time,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  return (
    <div>
      <p>Players: {playersQuery.data?.length}</p>
      <p>Removing players is reverable. No games will be deleted.</p>
      <section className="flex flex-col gap-2 mt-2">
        {playersQuery.data?.map((player) => (
          <div className="flex gap-2">
            <p>{player.name}</p>
            <button
              className="text-xs bg-red-500 hover:bg-red-800 text-white px-1 rounded-md"
              onClick={() => removePlayerMutation.mutate({ name: player.name })}
            >
              Remove
            </button>
          </div>
        ))}
      </section>

      <p>Games: {gamesQuery.data?.length}</p>
      <p>Deleting games is permanent.</p>
      <section className="flex flex-col-reverse gap-2 mt-2">
        {gamesQuery.data?.map((game) => (
          <div className="flex gap-2">
            <p>
              {game.winner} won over {game.loser} {timeAgo(new Date(game.time))}
            </p>
            <button
              className="text-xs bg-red-500 hover:bg-red-800 text-white px-1 rounded-md"
              onClick={() => deleteGameMutation.mutate(game)}
            >
              Delete
            </button>
          </div>
        ))}
      </section>
    </div>
  );
};
