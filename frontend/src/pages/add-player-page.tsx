import { useEffect, useState } from "react";
import { queryClient } from "../common/query-client";
import { useNavigate } from "react-router-dom";
import { classNames } from "../common/class-names";
import ConfettiExplosion from "react-confetti-explosion";
import { useEventDbContext } from "../wrappers/event-db-context";
import { useEventMutation } from "../hooks/use-event-mutation";
import { EventTypeEnum, PlayerCreated } from "../client/client-db/event-store/event-types";
import { newId } from "../common/nani-id";
import { stringToColor } from "../common/string-to-color";

export const AddPlayerPage: React.FC = () => {
  const navigate = useNavigate();
  const context = useEventDbContext();
  const addEventMutation = useEventMutation();
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState(newId());
  const [colorOptions, setColorOptions] = useState([
    newId(),
    newId(),
    newId(),
    newId(),
    newId(),
    newId(),
    newId(),
    newId(),
  ]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [playerSuccessfullyAdded, setPlayerSuccessfullyAdded] = useState(false);

  useEffect(() => {
    const validateResponse = context.eventStore.playersProjector.validatePlayerName(playerName);

    if (validateResponse.valid === false) {
      setErrorMessage(validateResponse.message);
    } else {
      setErrorMessage("");
    }
  }, [playerName, context.players, playerSuccessfullyAdded, context.eventStore.playersProjector]);

  function submitPlayer(name: string) {
    const event: PlayerCreated = {
      type: EventTypeEnum.PLAYER_CREATED,
      time: Date.now(),
      stream: playerId,
      data: { name },
    };

    const validateResponse = context.eventStore.playersProjector.validateCreatePlayer(event);
    if (validateResponse.valid === false) {
      console.error(validateResponse.message);
      setErrorMessage(validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, {
      onSuccess: (_, event) => {
        const data = event as PlayerCreated;
        queryClient.invalidateQueries();
        setPlayerSuccessfullyAdded(true);
        setTimeout(() => navigate(`/player/${data.stream}`), 2_000);
      },
      onError(error) {
        setErrorMessage(error.message);
      },
    });
  }

  function selectColor(selectedId: string) {
    setPlayerId(selectedId);
    setColorOptions([newId(), newId(), newId(), newId(), newId(), newId(), newId(), newId()]);
  }

  return (
    <div className="min-h-screen bg-primary-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-primary-background text-primary-text rounded-lg shadow-lg p-6 sm:p-8 space-y-6">
          {/* Header */}
          <h1 className="text-2xl sm:text-3xl font-bold text-center">Add Player</h1>

          {/* Player Name Input */}
          <div className="space-y-2">
            <label htmlFor="playerName" className="block text-sm font-medium">
              Player Name
            </label>
            <input
              id="playerName"
              type="text"
              className="w-full text-black ring-1 ring-primary-text rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-text/50 transition-all"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter player name"
            />
            {errorMessage && !playerSuccessfullyAdded && (
              <p className="text-sm text-red-400 bg-red-950/30 px-3 py-2 rounded-md border border-red-900/50">
                {errorMessage}
              </p>
            )}
          </div>

          {/* Color Picker */}
          <div className="space-y-3">
            <div
              className="w-full text-center flex items-center justify-center flex-col p-6 rounded-lg shadow-md"
              style={{ background: stringToColor(playerId) }}
            >
              <div className="size-24 font-bold rounded-full ring ring-white backdrop-blur-sm mb-2 flex items-center justify-center text-7xl">
                {playerName[0]}
              </div>
              <span className="font-semibold text-white drop-shadow-md">Player color</span>
            </div>

            {/* Color Options */}
            <p className="text-xs text-center text-primary-text">Click a color to select another color:</p>
            <div className="grid grid-cols-4 gap-2">
              {colorOptions.map((optionId) => (
                <button
                  key={optionId}
                  type="button"
                  className="aspect-square rounded-lg transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50"
                  style={{ background: stringToColor(optionId) }}
                  onClick={() => selectColor(optionId)}
                  aria-label="Select this color"
                >
                  Select
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            disabled={!!errorMessage || addEventMutation.isPending || !playerName}
            className={classNames(
              "w-full text-lg font-semibold flex flex-col items-center justify-center py-4 px-6 rounded-lg transition-all shadow-md",
              "bg-secondary-background hover:bg-secondary-background/70 text-secondary-text",
              "focus:outline-none focus:ring-2 focus:ring-secondary-background/50",
              (!!errorMessage || !playerName) && "cursor-not-allowed opacity-50 hover:bg-secondary-background",
              playerSuccessfullyAdded && "animate-ping-once",
            )}
            onClick={() => submitPlayer(playerName)}
          >
            {addEventMutation.isPending && (
              <div className="flex items-center justify-center gap-2">
                <span>Adding player...</span>
                <div className="animate-spin">👤</div>
              </div>
            )}
            {playerSuccessfullyAdded && (
              <>
                <span>Success ✅</span>
                <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />
              </>
            )}
            {!addEventMutation.isPending && !playerSuccessfullyAdded && "Add Player 👤"}
          </button>
        </div>
      </div>
    </div>
  );
};
