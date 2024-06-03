import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LeaderBoard } from "./leader-board";

export type PlayerSummary = {
  name: string;
  elo: number;
  wins: number;
  loss: number;
  games: {
    time: number;
    result: "win" | "loss";
    oponent: string;
    eloAfterGame: number;
    pointsDiff: number;
  }[];
};

export type PlayerSummaryDTO = PlayerSummary & {
  isRanked: boolean;
  rank?: number;
};

export type LeaderboardDTO = {
  rankedPlayers: (PlayerSummary & { rank: number })[];
  unrankedPlayers: (PlayerSummary & { potentialRank: number })[];
};

export function useLeaderBoardQuery() {
  return useQuery<LeaderboardDTO>({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      return fetch(`${process.env.REACT_APP_API_BASE_URL}/leaderboard`, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<LeaderboardDTO>);
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export const LeaderBoardPage: React.FC = () => {
  const leaderboardQuery = useLeaderBoardQuery();

  return (
    <div className="flex flex-col items-center">
      <section className="flex gap-x-4 gap-y-2 items-baseline flex-col w-56 sm:w-fit sm:flex-row p-1">
        <div className="whitespace-nowrap">Tennis🏆💔Table</div>
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
          className="w-full text-sm text-center whitespace-nowrap bg-pink-500/70 hover:bg-pink-900 text-white py-1 px-3 rounded-md font-thin"
          to="/compare-players"
        >
          Compare players 📊
        </Link>
        <Link
          className="w-full text-sm text-center whitespace-nowrap ring-[0.5px] font-thin ring-white text-white px-1 rounded-md"
          to="/admin"
        >
          To admin page 🔐
        </Link>
      </section>
      {(leaderboardQuery.isLoading || leaderboardQuery.isFetching) && (
        <div className="grid grid-cols-1 gap-1 grid-flow-row w-full">
          {Array.from({ length: 6 }, () => "").map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-lg bg-gray-500"
            />
          ))}
        </div>
      )}
      {leaderboardQuery.data &&
        !leaderboardQuery.isLoading &&
        !leaderboardQuery.isFetching && (
          <LeaderBoard leaderboard={leaderboardQuery.data} />
        )}
    </div>
  );
};
