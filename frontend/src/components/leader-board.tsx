import React from "react";
import { Link } from "react-router-dom";
import { LeaderboardDTO } from "./leader-board-page";

export const LeaderBoard: React.FC<{ leaderboard: LeaderboardDTO }> = ({
  leaderboard,
}) => {
  const nr1 = leaderboard.rankedPlayers[0];
  const nr2 = leaderboard.rankedPlayers[1];
  const nr3 = leaderboard.rankedPlayers[2];
  const lastPlace =
    leaderboard.rankedPlayers[leaderboard.rankedPlayers.length - 1];
  return (
    <div className="h-full w-fit md:flex space-y-4 space-x-4 pb-20">
      <div className="space-y-2">
        <Link
          to={`/player/${nr1.name}`}
          className="bg-gray-500/50 w-96 h-20 p-2 rounded-lg flex space-x-4 hover:bg-gray-500/75"
        >
          <div className="w-16 text-center text-6xl">🥇</div>
          <section className="grow">
            <h2 className="uppercase text-xl">{nr1.name} </h2>
            <section className="flex space-x-4 text-md">
              <div>
                {nr1.elo.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div>
                🏆 {nr1.wins} 💔 {nr1.loss}
              </div>
            </section>
          </section>
        </Link>
        <Link
          to={`/player/${nr2.name}`}
          className="bg-gray-500/50 w-96 h-16 p-2 rounded-lg flex space-x-4 hover:bg-gray-500/75"
        >
          <div className="w-16 text-center text-5xl">🥈</div>
          <section className="grow">
            <h2 className="uppercase text-lg">{nr2.name} </h2>
            <section className="flex space-x-4 text-sm">
              <div>
                {nr2.elo.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div>
                🏆 {nr2.wins} 💔 {nr2.loss}
              </div>
            </section>
          </section>
        </Link>
        <Link
          to={`/player/${nr3.name}`}
          className="bg-gray-500/50 w-96 h-14 p-2 rounded-lg flex space-x-4 hover:bg-gray-500/75"
        >
          <div className="w-16 text-center text-4xl">🥉</div>
          <section className="grow -mt-1">
            <h2 className="uppercase text-md">{nr3.name} </h2>
            <section className="flex space-x-4 text-sm">
              <div>
                {nr3.elo.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div>
                🏆 {nr3.wins} 💔 {nr3.loss}
              </div>
            </section>
          </section>
        </Link>

        <p className="w-full pl-20 ml-2 pt-2 italic">Last place...</p>
        <Link
          to={`/player/${lastPlace.name}`}
          className="bg-gray-500/50 w-96 h-12 p-2 rounded-lg flex space-x-4 hover:bg-gray-500/75"
        >
          <div className="w-16 text-center text-2xl">💩</div>
          <section className="grow -mt-1">
            <h2 className="uppercase text-sm">
              {lastPlace.name}{" "}
              <span className="font-thin text-slate-400 px-1">
                #{lastPlace.rank}
              </span>
            </h2>
            <section className="flex space-x-4 text-xs">
              <div>
                {lastPlace.elo.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div>
                🏆 {lastPlace.wins} 💔 {lastPlace.loss}
              </div>
            </section>
          </section>
        </Link>
      </div>
      <div className="w-96">
        <h1 className="text-2xl text-center">Leader Board</h1>
        <table className="w-full">
          <thead>
            <tr>
              <th>Player</th>
              <th className="text-right">Elo</th>
              <th className="text-right">Win 🏆</th>
              <th className="text-right">Loss 💔</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.rankedPlayers.map((player, index) => (
              <tr key={index}>
                <td>
                  <Link
                    to={`/player/${player.name}`}
                    className="h-full hover:bg-gray-500/50 flex w-full"
                  >
                    <div className="font-thin text-slate-400 w-10 text-center">
                      #{player.rank}
                    </div>
                    {player.name}
                  </Link>
                </td>
                <td className="text-right">
                  {player.elo.toLocaleString("no-NO", {
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td className="text-right">{player.wins}</td>
                <td className="text-right">{player.loss}</td>
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
              <th className="text-right">Win 🏆</th>
              <th className="text-right">Loss 💔</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.unrankedPlayers.map((player, index) => (
              <tr key={index}>
                <td>
                  <Link
                    to={`/player/${player.name}`}
                    className="h-full hover:bg-gray-500/50 flex w-full"
                  >
                    <div className="font-thin text-slate-400 w-10 text-center">
                      #{player.potentialRank}
                    </div>
                    {player.name}
                  </Link>
                </td>
                <td className="text-right">
                  {player.elo.toLocaleString("no-NO", {
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td className="text-right">{player.wins}</td>
                <td className="text-right">{player.loss}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
