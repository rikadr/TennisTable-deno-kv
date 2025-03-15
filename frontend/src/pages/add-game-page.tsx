import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { queryClient } from "../common/query-client";
import { Link, useNavigate } from "react-router-dom";
import { PlayersDTO } from "./admin/admin-page";
import { classNames } from "../common/class-names";
import { httpClient } from "../common/http-client";
import { useClientDbContext } from "../wrappers/client-db-context";
import ConfettiExplosion from "react-confetti-explosion";
import { useTennisParams } from "../hooks/use-tennis-params";
import { layerIndexToTournamentRound } from "./leaderboard/tournament-pending-games";

export const AddGamePage: React.FC = () => {
  const context = useClientDbContext();

  const navigate = useNavigate();
  const { player1: paramPlayer1, player2: paramPlayer2 } = useTennisParams();

  const [winner, setWinner] = useState<string | undefined>(paramPlayer1 || undefined);
  const [loser, setLoser] = useState<string | undefined>(paramPlayer2 || undefined);
  const [playersHaveBeenSet, setPlayersHaveBeenSet] = useState(false);

  const [gameSuccessfullyAdded, setGameSuccessfullyAdded] = useState(false);

  const isPendingTournamentGame = context.tournaments.findPendingGames(winner, loser);

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
      setGameSuccessfullyAdded(true);
      setTimeout(() => {
        navigate(
          isPendingTournamentGame.length > 0
            ? `/tournament?tournament=${isPendingTournamentGame[0].tournament.id}&player1=${isPendingTournamentGame[0].player1}&player2=${isPendingTournamentGame[0].player2}`
            : `/1v1/?player1=${winner}&player2=${loser}`,
        );
      }, 2_000);
    },
  });

  const { players } = useClientDbContext();

  function swapPlayers() {
    if (addGameMutation.isPending || gameSuccessfullyAdded) return;
    setWinner(loser);
    setLoser(winner);
  }

  useEffect(() => {
    // Scroll to top whenever both players have been set
    if (winner && loser && !playersHaveBeenSet) {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
      setPlayersHaveBeenSet(true);
    }
    if (!winner && !loser && playersHaveBeenSet) {
      setPlayersHaveBeenSet(false);
    }
  }, [winner, loser, playersHaveBeenSet]);

  return (
    <div className="w-full flex justify-center">
      <div className="space-y-4 p-4 w-fit">
        {isPendingTournamentGame.length > 0 && (
          <Link
            to={`/tournament?tournament=${isPendingTournamentGame[0].tournament.id}&player1=${isPendingTournamentGame[0].player1}&player2=${isPendingTournamentGame[0].player2}`}
          >
            <div className="ring-1 ring-secondary-background px-4 py-2 rounded-lg hover:bg-secondary-background/50">
              <p className="text-left italic text-xs">This game is pending in a tournament!</p>
              <h1>{isPendingTournamentGame[0].tournament.name}</h1>
              {isPendingTournamentGame[0].layerIndex !== undefined && (
                <p className="text-center text-lg">
                  {layerIndexToTournamentRound(isPendingTournamentGame[0].layerIndex)}
                </p>
              )}
              {isPendingTournamentGame[0].groupIndex !== undefined && (
                <p className="text-center text-lg">Group {isPendingTournamentGame[0].groupIndex + 1}</p>
              )}
            </div>
          </Link>
        )}
        <button
          disabled={!winner || !loser || addGameMutation.isPending}
          className={classNames(
            "text-lg font-semibold w-full py-4 px-6 flex flex-col items-center bg-secondary-background hover:bg-secondary-background/70 text-secondary-text rounded-lg",
            (!winner || !loser) && "cursor-not-allowed opacity-50 hover:bg-secondary-background",
            gameSuccessfullyAdded && "animate-ping-once",
          )}
          onClick={() => addGameMutation.mutate()}
        >
          {addGameMutation.isPending && (
            <div className="flex items-center justify-center gap-2">
              Adding game ... <div className="animate-spin">🏓</div>
            </div>
          )}
          {gameSuccessfullyAdded && "Success ✅"}
          {!addGameMutation.isPending && !gameSuccessfullyAdded && "Add game 🏓"}
          {gameSuccessfullyAdded && (
            <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />
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
        <div className="flex gap-2">
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
              disableSelection={addGameMutation.isPending || gameSuccessfullyAdded}
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
              disableSelection={addGameMutation.isPending || gameSuccessfullyAdded}
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
  disableSelection?: boolean;
}> = ({ players, selectedPlayer, disabledPlayer, onClick, disableSelection = false }) => {
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
            disabled={disableSelection}
            key={player.name}
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
