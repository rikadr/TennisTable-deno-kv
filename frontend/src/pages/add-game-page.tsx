import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient } from "../common/query-client";
import { useNavigate } from "react-router-dom";
import { PlayersDTO } from "./admin-page";
import { classNames } from "../common/class-names";
import { httpClient } from "../common/http-client";
import { useClientDbContext } from "../wrappers/client-db-context";

export const AddGamePage: React.FC = () => {
  const navigate = useNavigate();
  const [winner, setWinner] = useState<string | undefined>();
  const [loser, setLoser] = useState<string | undefined>();
  const [editSelection, setEditSelection] = useState(false);

  const addGameMutation = useMutation<unknown, Error>({
    mutationFn: async () => {
      return httpClient(`${process.env.REACT_APP_API_BASE_URL}/game`, {
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

  const { players } = useClientDbContext();

  function swapPlayers() {
    setWinner(loser);
    setLoser(winner);
  }

  return (
    <div className="w-full flex justify-center">
      <div className="space-y-4 p-4 w-fit">
        <button
          disabled={!winner || !loser || addGameMutation.isPending}
          className={classNames(
            "text-lg font-semibold w-full py-4 px-6 bg-secondary-background hover:bg-secondary-background/70 text-secondary-text rounded-lg",
            (!winner || !loser) && "cursor-not-allowed opacity-50 hover:bg-secondary-background",
          )}
          onClick={() => addGameMutation.mutate()}
        >
          {addGameMutation.isPending ? (
            <div className="flex items-center justify-center gap-2">
              Adding game ... <div className="animate-spin">🏓</div>
            </div>
          ) : (
            "Add game 🏓"
          )}
        </button>
        <div className="relative flex gap-2">
          <div className="w-40 h-20 flex flex-col items-center justify-center">
            <h1 className="text-5xl">🏆</h1>
            <h1 className="uppercase">{winner || "???"}</h1>
          </div>
          <div className="w-40 h-20 flex flex-col items-center justify-center">
            <h1 className="text-5xl">💔</h1>
            <h1 className="uppercase">{loser || "???"}</h1>
          </div>
          {(winner || loser) && (
            <button
              className="absolute inset-0 m-auto bg-secondary-background hover:bg-secondary-background/70 text-secondary-text rounded-full h-10 aspect-square text-2xl"
              onClick={swapPlayers}
            >
              &#8596;
            </button>
          )}
        </div>
        {winner && loser && !editSelection && (
          <button
            className="bg-secondary-background hover:bg-secondary-background/70 text-secondary-text rounded-lg h-10 w-full"
            onClick={() => setEditSelection(true)}
          >
            Edit selection
          </button>
        )}
        <div className={classNames("flex gap-2", winner && loser && !editSelection && "hidden")}>
          <div className="space-y-4">
            <PlayerList
              players={players}
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
            <PlayerList
              players={players}
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
  selectedPlayer?: string;
  disabledPlayer?: string;
  onClick: (name: string) => void;
}> = ({ players, selectedPlayer, disabledPlayer, onClick }) => {
  if (!players) {
    return <div>Failed to load players</div>;
  }

  const sortedPlayers = players.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  return (
    <div className="grid grid-cols-1 gap-1 grid-flow-row w-40">
      {sortedPlayers.map((player) => {
        const isSelected = selectedPlayer === player.name;
        const isDisabled = disabledPlayer === player.name;
        return (
          <button
            className={classNames(
              "h-8 text-left pl-4 rounded-lg",
              "bg-gray-500/50",
              isSelected && "bg-green-500/50 ring-2 ring-white",
              (isDisabled || (!!selectedPlayer && !isSelected)) && "text-gray-500",
              !isSelected && !isDisabled && "hover:bg-gray-500",
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
