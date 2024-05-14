import { useMutation, useQuery } from "@tanstack/react-query";
import React from "react";
import { queryClient } from "../common/query-client";

type PlayersDTO = {
  name: string;
}[];

export const AdminPage: React.FC = () => {
  const playersQuery = useQuery<PlayersDTO>({
    queryKey: ["players-elo"],
    queryFn: async () => {
      return fetch(`${process.env.REACT_APP_API_BASE_URL}/players`, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<PlayersDTO>);
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const removePlayerMutation = useMutation<
    unknown,
    Error,
    { name: string },
    unknown
  >({
    mutationFn: async ({ name }) => {
      return fetch(`${process.env.REACT_APP_API_BASE_URL}/player/${name}`, {
        method: "DELETE",
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
      <section className="flex flex-col gap-2">
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
    </div>
  );
};
