import { useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { SearchInput } from "./search-input";
import { PlayerList } from "./player-list";
import { SelectedPlayerCard } from "./selected-player-card";

export const StepSelectPlayers: React.FC<{
  player1: { id: string | null; set: (playerId: string | null) => void };
  player2: { id: string | null; set: (playerId: string | null) => void };
}> = ({ player1, player2 }) => {
  const context = useEventDbContext();
  const players = context.players;

  const [player1Search, setPlayer1Search] = useState("");
  const [player2Search, setPlayer2Search] = useState("");

  return (
    <div className="px-4 max-w-2xl m-auto">
      <h2 className="text-xl font-bold text-primary-text text-left mb-2">Player 1</h2>
      {player1.id && <SelectedPlayerCard playerId={player1.id} onClear={() => player1.set(null)} />}
      {!player1.id && (
        <>
          <SearchInput
            value={player1Search}
            onChange={(text) => setPlayer1Search(text)}
            placeholder="Search for player 1"
          />
          <PlayerList
            playerIds={players
              .filter(
                (p) =>
                  p.id !== player2.id && p.name.toLowerCase().trim().startsWith(player1Search.toLowerCase().trim()),
              )
              .map((player) => player.id)}
            onSelect={(playerId) => {
              player1.set(playerId);
              setPlayer1Search("");
            }}
          />
        </>
      )}
      <h2 className="text-xl font-bold text-primary-text text-left mb-2 mt-6">Player 2</h2>
      {player2.id && <SelectedPlayerCard playerId={player2.id} onClear={() => player2.set(null)} />}
      {player1.id && !player2.id && (
        <>
          <SearchInput
            value={player2Search}
            onChange={(text) => setPlayer2Search(text)}
            placeholder="Search for player 2"
          />
          <PlayerList
            playerIds={players
              .filter(
                (p) =>
                  p.id !== player1.id && p.name.toLowerCase().trim().startsWith(player2Search.toLowerCase().trim()),
              )
              .map((player) => player.id)}
            onSelect={(playerId) => {
              player2.set(playerId);
              setPlayer2Search("");
            }}
          />
        </>
      )}
    </div>
  );
};
