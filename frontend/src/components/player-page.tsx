import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
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

  const player = useMemo(
    () => playersEloQuery.data?.find((player) => player.name === name),
    [playersEloQuery.data, name]
  );

  const playerPositionIndex = useMemo(
    () => playersEloQuery.data?.findIndex((player) => player.name === name),
    [playersEloQuery.data, name]
  );

  return (
    <div className="flex flex-col items-center">
      <section className="space-y-1 my-4">
        <div className="bg-gray-500/50 w-96 h-20 p-2 rounded-lg flex space-x-4">
          <div className="w-16 text-3xl rounded-lg bg-white text-gray-500 flex items-center justify-center">
            {playerPositionIndex !== undefined
              ? "#" + (playerPositionIndex + 1)
              : "?"}
          </div>
          <section className="grow">
            <h2 className="uppercase text-xl">{name} </h2>
            <section className="flex space-x-4 text-md">
              <div>
                {player?.elo.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div>
                🏆{" "}
                {playerGamesQuery.data?.reduce(
                  (acc, cur) => (acc += cur.winner === name ? 1 : 0),
                  0
                )}{" "}
                💔{" "}
                {playerGamesQuery.data?.reduce(
                  (acc, cur) => (acc += cur.loser === name ? 1 : 0),
                  0
                )}
              </div>
            </section>
          </section>
        </div>
        <p>
          <b>
            #
            {(playersEloQuery.data?.findIndex(
              (player) => player.name === name
            ) ?? -2) + 1}{" "}
          </b>
          of {playersEloQuery.data?.length} players
        </p>
      </section>
      <div className="w-96">
        <h1 className="text-2xl text-center">
          Played {playerGamesQuery.data?.length} games
        </h1>
        <table className="w-full">
          <thead>
            <tr>
              <th>Result</th>
              <th>Oponent</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {playerGamesQuery.data?.map((game, index) => (
              <tr key={index} className="hover:bg-gray-500/50">
                <td className="text-right">
                  {game.winner === name ? "🏆" : "💔"}
                </td>
                <td className="text-left">{game.loser}</td>
                <td className="text-right">{timeAgo(new Date(game.time))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
