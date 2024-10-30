import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useClientDbContext } from "../wrappers/client-db-context";
import { Select } from "@headlessui/react";
import { PvPStats } from "./pvp-stats";

const PLAYER_1 = "player1";
const PLAYER_2 = "player2";

export const PvPPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const paramPlayer1 = searchParams.get(PLAYER_1);
  const paramPlayer2 = searchParams.get(PLAYER_2);

  const [player1, setPlayer1] = useState<string | undefined>(paramPlayer1 || undefined);
  const [player2, setPlayer2] = useState<string | undefined>(paramPlayer2 || undefined);

  return (
    <div className="space-y-4 max-w-4xl m-auto px-4">
      <div className="flex gap-4 justify-around">
        <SelectPlayer value={player1} onChange={(value) => setPlayer1(value)} />
        <SelectPlayer value={player2} onChange={(value) => setPlayer2(value)} />
      </div>
      <PvPStats player1={player1} player2={player2} />
    </div>
  );
};

export const SelectPlayer: React.FC<{ value?: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
  const { players } = useClientDbContext();
  const sortedPlayers = players.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-lg text-primary-text appearance-none bg-primary-background ring-1 ring-secondary-background px-4 py-4 rounded-lg w-full md:w-64"
    >
      {!value && <option key="No selected">Select player</option>}
      {sortedPlayers.map((player) => (
        <option value={player.name} key={player.name}>
          {player.name}
        </option>
      ))}
    </Select>
  );
};
