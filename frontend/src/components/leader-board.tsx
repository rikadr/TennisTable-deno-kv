import React from "react";
import { GameTableDTO } from "./table-page";
import { Link } from "react-router-dom";

export const LeaderBoard: React.FC<{ gameTable: GameTableDTO }> = ({
  gameTable,
}) => {
  const nr1 = gameTable.players[0];
  const nr2 = gameTable.players[1];
  const nr3 = gameTable.players[2];
  return (
    <div className="h-full w-full md:flex space-y-4 space-x-4">
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
                🏆 {nr1.wins.reduce((acc, cur) => (acc += cur.count), 0)} 💔{" "}
                {nr1.loss.reduce((acc, cur) => (acc += cur.count), 0)}
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
                🏆 {nr2.wins.reduce((acc, cur) => (acc += cur.count), 0)} 💔{" "}
                {nr2.loss.reduce((acc, cur) => (acc += cur.count), 0)}
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
                🏆 {nr3.wins.reduce((acc, cur) => (acc += cur.count), 0)} 💔{" "}
                {nr3.loss.reduce((acc, cur) => (acc += cur.count), 0)}
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
              <th>Elo</th>
              <th>Wins</th>
              <th>Losses</th>
            </tr>
          </thead>
          <tbody>
            {gameTable.players.map((player, index) => (
              <tr key={index}>
                <td>
                  <Link
                    to={`/player/${player.name}`}
                    className="w-20 h-full hover:bg-gray-500/50"
                  >
                    <span className="font-thin text-slate-400 pr-2">
                      #{index + 1}
                    </span>
                    {player.name}
                  </Link>
                </td>
                <td>
                  {player.elo.toLocaleString("no-NO", {
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td>
                  {player.wins.reduce((acc, cur) => (acc += cur.count), 0)}
                </td>
                <td>
                  {player.loss.reduce((acc, cur) => (acc += cur.count), 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
