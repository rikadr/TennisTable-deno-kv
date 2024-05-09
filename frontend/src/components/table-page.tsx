import React, { useEffect, useState } from "react";
export type GameTableDTO = {
  players: {
    name: string;
    elo: number;
    wins: { oponent: string; count: number }[];
    loss: { oponent: string; count: number }[];
  }[];
};

export const TablePage: React.FC = () => {
  const [data, setData] = useState<GameTableDTO>();
  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/game-table`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then(async (response) => response.json())
      .then((data) => setData(data));
  }, []);
  return (
    <div>
      <h1>Tennis Table</h1>
      {data?.players.map((player) => {
        return (
          <div key={player.name} className="my-4">
            <div className="flex items-baseline space-x-3">
              <h2>{player.name}</h2>
              <p>
                ELO:{" "}
                {player.elo.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div className="flex space-x-2">
              <div>
                <h3>Wins</h3>
                {player.wins.map((win) => (
                  <p key={win.oponent}>
                    {win.oponent}: {win.count}
                  </p>
                ))}
              </div>
              <div>
                <h3>Loss</h3>
                {player.loss.map((loss) => (
                  <p key={loss.oponent}>
                    {loss.oponent}: {loss.count}
                  </p>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
