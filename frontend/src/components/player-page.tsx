import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useParams } from "react-router-dom";
import { timeAgo } from "../common/date-utils";

type PlayerGamesDTO = {
  winner: string;
  loser: string;
  time: number;
}[];

type PlayersEloDTO = {
  name: string;
  elo: number;
}[];

export const PlayerPage: React.FC = () => {
  const { name } = useParams();

  const playerGamesQuery = useQuery<PlayerGamesDTO>({
    queryKey: ["player-games", name],
    queryFn: async () => {
      return fetch(`${process.env.REACT_APP_API_BASE_URL}/games/${name}`, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<PlayerGamesDTO>);
    },
    enabled: !!name,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const playersEloQuery = useQuery<PlayersEloDTO>({
    queryKey: ["players-elo"],
    queryFn: async () => {
      return fetch(`${process.env.REACT_APP_API_BASE_URL}/elo`, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<PlayersEloDTO>);
    },
    enabled: !!name,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  return (
    <div>
      <section className="space-y-1 mb-4">
        <h1>Player: {name}</h1>
        <p>
          Elo:{" "}
          {playersEloQuery.data
            ?.find((player) => player.name === name)
            ?.elo?.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
          ,{" "}
          <b>
            #
            {(playersEloQuery.data?.findIndex(
              (player) => player.name === name
            ) ?? -2) + 1}{" "}
          </b>
          of {playersEloQuery.data?.length} players
        </p>
      </section>
      <p>Played {playerGamesQuery.data?.length} games</p>
      <section className="flex flex-col-reverse">
        {playerGamesQuery.data?.map((game) => (
          <p>
            {game.winner === name
              ? `🏆 Won over ${game.loser}`
              : `💔 Lost to ${game.winner}`}{" "}
            {timeAgo(new Date(game.time))}
          </p>
        ))}
      </section>
    </div>
  );
};
