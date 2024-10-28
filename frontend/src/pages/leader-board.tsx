import React from "react";
import { Link } from "react-router-dom";
import { useClientDbContext } from "../wrappers/client-db-context";
import { PodiumPlace } from "./podium-place";

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
    <div className="w-full px-4 flex flex-col justify-center items-center gap-6 md:flex-row ">
      <div className="w-full max-w-96 sm:w-96 flex flex-col gap-2 items-center">
        <PodiumPlace place="1" player={nr1} />
        <PodiumPlace place="2" player={nr2} />
        <PodiumPlace place="3" player={nr3} />
        {/* <p className="pt-2 italic">Last place...</p>
        <PodiumPlace place="last" player={lastPlace} /> */}
      </div>
      <div className="w-96 shrink-0">
        <h1 className="text-2xl text-center">Leader Board</h1>
        <table className="w-full">
          <thead>
            <tr>
              <th>Player</th>
              <th className="text-right">Elo</th>
              {/* <th className="text-right">Win 🏆</th>
              <th className="text-right">Loss 💔</th> */}
              <th className="text-right">🏆:💔</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.rankedPlayers.map((player, index) => (
              <tr key={index}>
                <td>
                  <Link to={`/player/${player.name}`} className="h-full hover:bg-secondary-background/10 flex w-full">
                    <div className="font-thin text-primary-text w-10 text-center">#{player.rank}</div>
                    {player.name}
                  </Link>
                </td>
                <td className="text-right">
                  {player.elo.toLocaleString("no-NO", {
                    maximumFractionDigits: 0,
                  })}
                </td>
                {/* <td className="text-right">{player.wins}</td>
                <td className="text-right">{player.loss}</td> */}
                <td className="text-right">
                  {(player.wins / player.loss).toLocaleString("no-NO", {
                    maximumFractionDigits: 1,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h1 className="text-2xl text-center mt-10">Unranked players</h1>
        <p className="w-full text-center">Play 5 or more games to get ranked</p>
        <table className="w-full">
          <thead>
            <tr>
              <th>Potential rank for Player</th>
              <th className="text-right">Elo</th>
              {/* <th className="text-right">Win 🏆</th>
              <th className="text-right">Loss 💔</th> */}
              <th className="text-right">🏆:💔</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.unrankedPlayers.map((player, index) => (
              <tr key={index}>
                <td>
                  <Link to={`/player/${player.name}`} className="h-full hover:bg-secondary-background/10 flex w-full">
                    <div className="font-thin text-primary-text w-10 text-center">#{player.potentialRank}</div>
                    {player.name}
                  </Link>
                </td>
                <td className="text-right">
                  {player.elo.toLocaleString("no-NO", {
                    maximumFractionDigits: 0,
                  })}
                </td>
                {/* <td className="text-right">{player.wins}</td>
                <td className="text-right">{player.loss}</td> */}
                <td className="text-right">
                  {(player.wins / player.loss).toLocaleString("no-NO", {
                    maximumFractionDigits: 1,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
