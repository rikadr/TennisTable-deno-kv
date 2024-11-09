import { useMutation } from "@tanstack/react-query";
import React from "react";
import { queryClient } from "../common/query-client";
import { timeAgo } from "../common/date-utils";
import { httpClient } from "../common/http-client";
import { Users } from "./users";
import { useClientDbContext } from "../wrappers/client-db-context";
import { session } from "../services/auth";

export type PlayersDTO = {
  name: string;
}[];
export const AdminPage: React.FC = () => {
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

  const { games, players } = useClientDbContext();

  if (session.sessionData?.role !== "admin") {
    return <div>Not authorized</div>;
  }

  return (
    <div>
      <Users />
      <p>Players: {players.length}</p>
      <p>Removing players is reverable. No games will be deleted.</p>
      <section className="flex flex-col gap-2 mt-2">
        {players.map((player) => (
          <div className="flex gap-2" key={player.name}>
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

      <p>Games: {games.length}</p>
      <p>Deleting games is permanent.</p>
      <section className="flex flex-col-reverse gap-2 mt-2">
        {games.map((game) => (
          <div className="flex gap-2" key={game.time}>
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
