import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient } from "../common/query-client";
import { useNavigate } from "react-router-dom";
import { PlayersDTO } from "./admin-page";
import { classNames } from "../common/class-names";

export const AddGamePage: React.FC = () => {
  const navigate = useNavigate();
  const [winner, setWinner] = useState<string | undefined>();
  const [loser, setLoser] = useState<string | undefined>();

  const playersQuery = useQuery<PlayersDTO>({
    queryKey: ["all-players"],
    queryFn: async () => {
      return fetch(`${process.env.REACT_APP_API_BASE_URL}/players`, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<PlayersDTO>);
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const addGameMutation = useMutation<unknown, Error>({
    mutationFn: async () => {
      return fetch(`${process.env.REACT_APP_API_BASE_URL}/game`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          winner,
          loser,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      navigate("/");
    },
  });

  return (
    <div className="w-full flex justify-center">
      <div className="space-y-4 p-4 w-fit">
        <button
          disabled={!winner || !loser}
          className={classNames(
            "text-lg w-full py-4 px-6 bg-green-700 hover:bg-green-900 text-white rounded-lg font-normal",
            (!winner || !loser) &&
              "bg-green-700/0 hover:bg-green-700/0 text-gray-300 cursor-not-allowed ring-1 ring-gray-500"
          )}
          onClick={() => addGameMutation.mutate()}
        >
          Add game 🏓
        </button>
        <div className="flex gap-2">
          <div className="space-y-4">
            <div className="w-40 h-20 flex flex-col items-center justify-center">
              <h1 className="text-5xl">🏆</h1>
              <h1 className="uppercase">{winner || "???"}</h1>
            </div>
            <PlayerList
              players={playersQuery.data}
              isLoading={playersQuery.isLoading}
              onClick={(name) =>
                setWinner((prev) => {
                  if (name === loser) {
                    setLoser(undefined);
                    return name;
                  }
                  if (prev === name) {
                    return undefined;
                  }
                  return name;
                })
              }
              selectedPlayer={winner}
              disabledPlayer={loser}
            />
          </div>
          <div className="space-y-4">
            <div className="w-40 h-20 flex flex-col items-center justify-center">
              <h1 className="text-5xl">💔</h1>
              <h1 className="uppercase">{loser || "???"}</h1>
            </div>
            <PlayerList
              players={playersQuery.data}
              isLoading={playersQuery.isLoading}
              onClick={(name) =>
                setLoser((prev) => {
                  if (name === winner) {
                    setWinner(undefined);
                    return name;
                  }
                  if (prev === name) {
                    return undefined;
                  }
                  return name;
                })
              }
              selectedPlayer={loser}
              disabledPlayer={winner}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const PlayerList: React.FC<{
  players?: PlayersDTO;
  isLoading: boolean;
  selectedPlayer?: string;
  disabledPlayer?: string;
  onClick: (name: string) => void;
}> = ({ players, isLoading, selectedPlayer, disabledPlayer, onClick }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-1 grid-flow-row w-40">
        {Array.from({ length: 6 }, () => "").map(() => (
          <div className="h-8 animate-pulse rounded-lg bg-gray-500" />
        ))}
      </div>
    );
  }
  if (!players) {
    return <div>Failed to load players</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-1 grid-flow-row w-40">
      {players.map((player) => {
        const isSelected = selectedPlayer === player.name;
        const isDisabled = disabledPlayer === player.name;
        return (
          <button
            className={classNames(
              "h-8 text-left pl-4 rounded-lg",
              "bg-gray-500/50",
              isSelected && "bg-green-500/50 ring-2 ring-white",
              isDisabled && "text-gray-500",
              !isSelected && !isDisabled && "hover:bg-gray-500"
            )}
            onClick={() => onClick(player.name)}
          >
            {player.name}
          </button>
        );
      })}
    </div>
  );
};
