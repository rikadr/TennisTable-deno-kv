import { useEffect, useState } from "react";
import { queryClient } from "../common/query-client";
import { useNavigate } from "react-router-dom";
import { classNames } from "../common/class-names";
import ConfettiExplosion from "react-confetti-explosion";
import { useEventDbContext } from "../wrappers/event-db-context";
import { useEventMutation } from "../hooks/use-event-mutation";
import { EventTypeEnum, PlayerCreated } from "../client/client-db/event-store/event-types";
import { newId } from "../common/nani-id";

export const AddPlayerPage: React.FC = () => {
  const navigate = useNavigate();
  const context = useEventDbContext();
  const addEventMutation = useEventMutation();

  const [playerName, setPlayerName] = useState("");

  const [errorMessage, setErrorMessage] = useState<string>();

  const [playerSuccessfullyAdded, setPlayerSuccessfullyAdded] = useState(false);

  useEffect(() => {
    const playerExists = !!context.players.find((p) => p.name.toLowerCase() === playerName.toLowerCase());
    const firstLetterIsUpperCase = playerName[0] === playerName[0]?.toUpperCase();
    const hasSpecialCharacters = /[!@#$%^&*()+=[\]{};':"\\|,.<>/?]+/.test(playerName);

    if (playerExists && !playerSuccessfullyAdded) {
      setErrorMessage("Player already exists");
    } else if (!firstLetterIsUpperCase) {
      setErrorMessage("Please uppercase first letter");
    } else if (hasSpecialCharacters) {
      setErrorMessage("The string contains special or invalid characters.");
    } else {
      setErrorMessage(undefined);
    }
  }, [playerName, context.players, playerSuccessfullyAdded]);

  function fixName(n: string): string {
    return (n[0]?.toUpperCase() + n.slice(1)).trim();
  }

  function submitPlayer(name: string) {
    const event: PlayerCreated = {
      type: EventTypeEnum.PLAYER_CREATED,
      time: Date.now(),
      stream: newId(),
      data: {
        name,
      },
    };

    const validateResponse = context.eventStore.playersReducer.validateCreatePlayer(event);
    if (validateResponse.valid === false) {
      setErrorMessage(validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, {
      onSuccess: (_, event) => {
        const data = event as PlayerCreated;
        queryClient.invalidateQueries();
        setPlayerSuccessfullyAdded(true);
        setTimeout(() => {
          navigate(`/player/${fixName(data.data.name)}`); // TODO change to id?
        }, 2_000);
      },
      onError(error) {
        setErrorMessage(error.message);
      },
    });
  }

  return (
    <div className="flex flex-col items-center gap-2 w-96 m-auto">
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
        disabled={!!errorMessage || addEventMutation.isPending || !playerName}
        className={classNames(
          "text-lg font-semibold w-full flex flex-col items-center py-4 px-6 bg-secondary-background hover:bg-secondary-background/70 text-secondary-text rounded-lg",
          (!!errorMessage || !playerName) && "cursor-not-allowed opacity-50 hover:bg-secondary-background",
          playerSuccessfullyAdded && "animate-ping-once",
        )}
        onClick={() => submitPlayer(playerName)}
      >
        {addEventMutation.isPending && (
          <div className="flex items-center justify-center gap-2">
            Adding player ... <div className="animate-spin">👤</div>
          </div>
        )}
        {playerSuccessfullyAdded && "Success ✅"}
        {!addEventMutation.isPending && !playerSuccessfullyAdded && "Add player 👤"}
        {playerSuccessfullyAdded && (
          <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />
        )}
      </button>
    </div>
  );
};
