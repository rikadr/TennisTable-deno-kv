import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { timeAgo } from "../common/date-utils";
import { usePlayerSummaryQuery } from "./leader-board-page";
export const PlayerPage: React.FC = () => {
  const { name } = useParams();

  const playerSummaryQuery = usePlayerSummaryQuery(name);

  const reverseGames = useMemo(() => {
    if (!playerSummaryQuery.data) return;
    return playerSummaryQuery.data.games.slice().reverse();
  }, [playerSummaryQuery.data]);

  return (
    <div className="flex flex-col items-center">
      <Link
        to="/"
        className="whitespace-nowrap text-sm font-thin ring-1 ring-white px-2 py-1 mt-1 rounded-lg hover:bg-gray-500/50"
      >
        Back to leaderboard
      </Link>
      <section className="space-y-1 my-4">
        <div className="bg-gray-500/50 w-96 h-20 p-2 rounded-lg flex space-x-4">
          {playerSummaryQuery.data?.isRanked ? (
            <div className="w-16 text-3xl rounded-lg bg-white text-gray-500 flex items-center justify-center">
              #{playerSummaryQuery.data.rank}
            </div>
          ) : (
            <div className="w-16 text-sm rounded-lg bg-white text-gray-500 flex items-center justify-center">
              <p className="text-center"> Not yet ranked</p>
            </div>
          )}
          <section className="grow">
            <h2 className="uppercase text-xl">{name} </h2>
            <section className="flex space-x-4 text-md">
              <div>
                {playerSummaryQuery.data?.elo.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div>
                🏆 {playerSummaryQuery.data?.wins} 💔{" "}
                {playerSummaryQuery.data?.loss}
              </div>
            </section>
          </section>
        </div>
      </section>
      <div className="w-fit">
        <h1 className="text-2xl text-center">
          {playerSummaryQuery.data &&
            playerSummaryQuery.data.games.length + " games"}
        </h1>
        {playerSummaryQuery.isLoading ? (
          <div>
            Loading games ...
            <div className="flex items-center justify-center w-full">
              <div className="animate-spin w-min">🏆</div>
              <div className="animate-spin w-min">💔</div>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th>Game</th>
                <th>Elo +-</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {reverseGames?.map((game, index) => {
                return (
                  <tr key={index}>
                    <td className="text-left px-4">
                      <Link
                        to={`/player/${game.oponent}`}
                        className="h-full hover:bg-gray-500/50 flex w-full"
                      >
                        {game.result === "win" ? "🏆 " : "💔 "} {game.oponent}
                      </Link>
                    </td>
                    <td className="text-right pr-4">
                      {game.pointsDiff.toLocaleString("no-NO", {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="text-right">
                      {timeAgo(new Date(game.time))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
