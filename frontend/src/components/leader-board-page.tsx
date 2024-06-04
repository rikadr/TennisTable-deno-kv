import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LeaderBoard } from "./leader-board";

import { httpClient } from "./login";
import { classNames } from "../common/class-names";
import { session } from "../services/auth";

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
      return httpClient(`${process.env.REACT_APP_API_BASE_URL}/leaderboard`, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<LeaderboardDTO>);
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

const NavigationLink: React.FC<
  { to: string; text: string; className?: string }
> = (
  props,
) => {
  return (
    <Link
      className={classNames(
        "w-full text-sm text-center whitespace-nowrap text-white py-1 px-3 rounded-md font-thin",
        props.className,
      )}
      to={props.to}
    >
      {props.text}
    </Link>
  );
};

const LogOutButton: React.FC<{ className?: string }> = (props) => {
  return (
    <button
      className={classNames(
        "w-full text-sm text-center whitespace-nowrap text-white py-1 px-3 rounded-md font-thin",
        props.className,
      )}
      onClick={() => {
        session.token = undefined;
        window.location.reload();
      }}
    >
      Log Out 🔓
    </button>
  );
};

export const LeaderBoardPage: React.FC = () => {
  const leaderboardQuery = useLeaderBoardQuery();

  return (
    <div className="flex flex-col items-center">
      <section className="flex gap-x-4 gap-y-2 items-baseline flex-col w-56 sm:w-fit sm:flex-row p-1">
        <div className="whitespace-nowrap">Tennis🏆💔Table</div>
        <NavigationLink
          to="/add-game"
          text="Add played game +🏓"
          className="bg-green-700 hover:bg-green-900"
        />
        <NavigationLink
          to="/add-player"
          text="Add player +👤"
          className="bg-green-700 hover:bg-green-900"
        />
        <NavigationLink
          to="/compare-players"
          text="Compare players 📊"
          className="bg-pink-500/70 hover:bg-pink-900"
        />
        {session.isAuthenticated
          ? (
            <>
              <LogOutButton className="bg-blue-700 hover:bg-blue-900" />
              <NavigationLink to="/admin" text="To admin page 🔐" />
            </>
          )
          : (
            <NavigationLink
              to="/login"
              text="Log In 🔐"
              className="bg-blue-700 hover:bg-blue-900"
            />
          )}
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
      {leaderboardQuery.data && !leaderboardQuery.isLoading &&
        !leaderboardQuery.isFetching && (
        <LeaderBoard leaderboard={leaderboardQuery.data} />
      )}
    </div>
  );
};
