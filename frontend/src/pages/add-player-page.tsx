import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { queryClient } from "../common/query-client";
import { useNavigate } from "react-router-dom";
import { httpClient } from "../common/http-client";
import { useClientDbContext } from "../wrappers/client-db-context";
import { classNames } from "../common/class-names";
import ConfettiExplosion from "react-confetti-explosion";

export const AddPlayerPage: React.FC = () => {
  const navigate = useNavigate();
  const context = useClientDbContext();

  const [playerName, setPlayerName] = useState("");
  const backendError = "An error occurred while adding player";

  const [errorMessage, setErrorMessage] = useState<string>();

  const [playerSuccessfullyAdded, setPlayerSuccessfullyAdded] = useState(false);

  useEffect(() => {
    const playerExists = !!context.players.find((p) => p.name.toLowerCase() === playerName.toLowerCase());
    const firstLetterIsUpperCase = playerName[0] === playerName[0]?.toUpperCase();
    if (playerExists && !playerSuccessfullyAdded) {
      setErrorMessage("Player already exists");
    } else if (!firstLetterIsUpperCase) {
      setErrorMessage("Please uppercase first letter");
    } else {
      setErrorMessage(undefined);
    }
  }, [playerName, context.players, playerSuccessfullyAdded]);

  const addPlayerMutation = useMutation<unknown, Error, { name: string }, unknown>({
    mutationFn: async ({ name }) => {
      const upperCasedName = name[0]?.toUpperCase() + name.slice(1);
      try {
        return await httpClient(`${process.env.REACT_APP_API_BASE_URL}/player`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: upperCasedName,
          }),
        });
      } catch (error) {
        setErrorMessage(backendError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setPlayerSuccessfullyAdded(true);
      setTimeout(() => {
        navigate("/leader-board");
      }, 2_000);
    },
    onError(error) {
      setErrorMessage(error.message);
    },
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <h1>Add player</h1>
      <p>Player name</p>
      <input
        type="text"
        className="text-black"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Name"
      />
      {errorMessage && <p className="text-red-500">{errorMessage}</p>}
      <button
        disabled={!!errorMessage}
        className={classNames(
          "text-sm bg-green-700 hover:bg-green-900 text-white px-1 rounded-md font-thin",
          !!errorMessage && "cursor-not-allowed bg-gray-700 hover:bg-gray-700",
          playerSuccessfullyAdded && "animate-ping-once",
        )}
        onClick={() => addPlayerMutation.mutate({ name: playerName })}
      >
        Add player
        {playerSuccessfullyAdded && <ConfettiExplosion particleCount={400} force={0.8} duration={4_000} />}
      </button>
    </div>
  );
};
