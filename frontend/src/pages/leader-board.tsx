import React from "react";
import { Link } from "react-router-dom";
import { useClientDbContext } from "../wrappers/client-db-context";
import { PodiumPlace } from "./podium-place";
import { Elo } from "../wrappers/elo";

export const LeaderBoard: React.FC = () => {
  const context = useClientDbContext();
  const leaderboard = context.leaderboard.getLeaderboard();

  const nr1 = leaderboard.rankedPlayers[0];
  const nr2 = leaderboard.rankedPlayers[1];
  const nr3 = leaderboard.rankedPlayers[2];

  if (!nr1 || !nr2 || !nr3) {
    return <div>Need at least 3 players to show leaderboard</div>;
  }

  // const lastPlace = leaderboard.rankedPlayers[leaderboard.rankedPlayers.length - 1];

  return (
    <div className="w-full px-4 flex flex-col justify-center items-center md:items-start gap-6 md:flex-row ">
      <div className="w-full max-w-96 sm:w-96 flex flex-col gap-2 items-center">
        <PodiumPlace size="default" place={1} player={nr1} />
        <PodiumPlace size="sm" place={2} player={nr2} />
        <PodiumPlace size="xs" place={3} player={nr3} />
        {/* <p className="pt-2 italic">Last place...</p>
        <PodiumPlace size="xs" place={leaderboard.rankedPlayers.length} player={lastPlace} /> */}
      </div>
      <div className="w-fit shrink-0">
        <h1 className="text-2xl text-center mb-4">Leader Board</h1>
        <div className="flex flex-col divide-y divide-primary-text/50">
          <div className="flex gap-4 text-base text-center mb-2">
            <div className="w-5">#</div>
            <div className="w-32 text-left pl-2">Name</div>
            <div className="w-12 text-right">Elo</div>
            <div className="w-10 ml-1">Interval</div>
            <div className="w-14 text-right">🏆:💔</div>
          </div>
          {leaderboard.rankedPlayers.map((player, index, list) => (
            <Link
              key={index}
              to={`/player/${player.name}`}
              className="bg-primary-background hover:bg-secondary-background/30 py-1 px-2 flex gap-4 text-xl font-light"
            >
              <div className="w-5 italic">{player.rank}</div>
              <div className="w-32 font-normal whitespace-nowrap">{player.name}</div>
              <div className="w-12 text-right">
                {player.elo.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div className="w-10 text-right text-base">
                {list[index - 1]
                  ? (player.elo - list[index - 1].elo).toLocaleString("no-NO", {
                      maximumFractionDigits: 0,
                    })
                  : "-"}
              </div>
              <div className="w-10 text-right text-base">
                {(player.wins / player.loss).toLocaleString("no-NO", {
                  maximumFractionDigits: 1,
                })}
              </div>
            </Link>
          ))}
        </div>

        <h1 className="text-2xl text-center mt-10">Unranked players</h1>
        <p className="w-full text-center mb-4">Play {Elo.GAME_LIMIT_FOR_RANKED} or more games to get ranked</p>
        <div className="flex flex-col divide-y divide-primary-text/50">
          <div className="flex gap-4 text-base text-center mb-2">
            <div className="w-32 text-left pl-2">Name</div>
            <div className="w-12 text-right">Elo</div>
            <div className="w-14 text-right">🏆:💔</div>
          </div>
          {leaderboard.unrankedPlayers.map((player, index, list) => (
            <Link
              key={index}
              to={`/player/${player.name}`}
              className="bg-primary-background hover:bg-secondary-background/30 py-1 px-2 flex gap-4 text-xl font-light"
            >
              <div className="w-32 font-normal whitespace-nowrap">{player.name}</div>
              <div className="w-12 text-right">
                {player.elo.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div className="w-10 text-right text-base">
                {(player.wins / player.loss).toLocaleString("no-NO", {
                  maximumFractionDigits: 1,
                })}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
