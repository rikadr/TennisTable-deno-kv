import React, { useEffect, useState } from "react";
import { TennisTable } from "./tennis-table";
export type GameTableDTO = {
  players: GameTablePlayer[];
};
export type GameTablePlayer = {
  name: string;
  elo: number;
  wins: { oponent: string; count: number }[];
  loss: { oponent: string; count: number }[];
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
      <section className="flex gap-4 items-baseline">
        <h1>Tennis Table</h1>
        <p>Click any cell to register a played game 🏓</p>
      </section>
      {data && <TennisTable gameTable={data} />}
    </div>
  );
};
