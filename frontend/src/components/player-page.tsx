import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import { timeAgo } from "../common/date-utils";
import { useLeaderBoardQuery } from "./leader-board-page";

type PlayerGamesDTO = {
  winner: string;
  loser: string;
  time: number;
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

  const leaderboardQuery = useLeaderBoardQuery();

  const playerRanked = leaderboardQuery.data?.rankedPlayers.find(
    (player) => player.name === name
  );
  const playerUnranked = leaderboardQuery.data?.unrankedPlayers.find(
    (player) => player.name === name
  );

  const reversePlayerGames = useMemo(() => {
    if (!playerGamesQuery.data) return;
    return playerGamesQuery.data.slice().reverse();
  }, [playerGamesQuery.data]);

  return (
    <div className="flex flex-col items-center">
      <section className="space-y-1 my-4">
        <div className="bg-gray-500/50 w-96 h-20 p-2 rounded-lg flex space-x-4">
          <div className="w-16 text-3xl rounded-lg bg-white text-gray-500 flex items-center justify-center">
            #{playerRanked?.rank || `${playerUnranked?.potentialRank}*` || "?"}
          </div>
          <section className="grow">
            <h2 className="uppercase text-xl">{name} </h2>
            <section className="flex space-x-4 text-md">
              <div>
                {(playerRanked || playerUnranked)?.elo.toLocaleString("no-NO", {
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
          {playerUnranked && "Potentially"}{" "}
          <b>
            #{playerRanked?.rank || `${playerUnranked?.potentialRank}` || "?"}{" "}
          </b>
          of{" "}
          {playerRanked &&
            `${leaderboardQuery.data?.rankedPlayers.length} ranked players`}
          {playerUnranked &&
            leaderboardQuery.data &&
            `${
              leaderboardQuery.data.rankedPlayers.length +
              leaderboardQuery.data.unrankedPlayers.length
            } total ranked + unranked players`}
        </p>
      </section>
      <div className="w-fit">
        <h1 className="text-2xl text-center">
          {playerGamesQuery.data?.length || 0} games
        </h1>
        <table className="w-full">
          <thead>
            <tr>
              <th>Game</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {reversePlayerGames?.map((game, index) => (
              <tr key={index} className="hover:bg-gray-500/50">
                <td className="text-left px-4">
                  {game.winner === name
                    ? "🏆 " + game.loser
                    : "💔 " + game.winner}
                </td>
                <td className="text-right">{timeAgo(new Date(game.time))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
