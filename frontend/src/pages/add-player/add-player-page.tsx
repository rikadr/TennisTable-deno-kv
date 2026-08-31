import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfettiExplosion from "react-confetti-explosion";
import { queryClient } from "../../common/query-client";
import { classNames } from "../../common/class-names";
import { newId } from "../../common/nani-id";
import { StepIndicator } from "../../common/step-indicator";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { useEventMutation } from "../../hooks/use-event-mutation";
import { useKeyboardInset } from "../../hooks/use-keyboard-inset";
import { EventTypeEnum, PlayerCreated } from "../../client/client-db/event-store/event-types";
import { StepPlayerName } from "./step-player-name";
import { StepPlayerColor } from "./step-player-color";
import { StepPlayerPhoto } from "./step-player-photo";

export const ADD_PLAYER_STEPS = [
  { step: 1, title: "Name", icon: "👤" },
  { step: 2, title: "Color", icon: "🎨" },
  { step: 3, title: "Photo", icon: "📸" },
] as const;

const COLOR_OPTIONS_COUNT = 8;
const newColorOptions = () => Array.from({ length: COLOR_OPTIONS_COUNT }, () => newId());

export const AddPlayerPage: React.FC = () => {
  const navigate = useNavigate();
  const context = useEventDbContext();
  const addEventMutation = useEventMutation({ suppressErrorToast: true });
  const keyboardInset = useKeyboardInset();

  const [currentStep, setCurrentStep] = useState(1);
  const [playerName, setPlayerName] = useState("");
  // The color of a player comes from the player id, so selecting a color means
  // selecting the id the player gets. It is permanent after the player exists.
  const [playerId, setPlayerId] = useState(newId());
  const [colorOptions, setColorOptions] = useState(newColorOptions);
  const [understandsPermanent, setUnderstandsPermanent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const nameValidation = context.eventStore.playersProjector.validatePlayerName(playerName);
  const nameError = nameValidation.valid === false ? nameValidation.message : undefined;
  const nameIsValid = !!playerName && nameError === undefined;

  function selectColor(selectedId: string) {
    setPlayerId(selectedId);
    setColorOptions(newColorOptions());
  }

  function createPlayer() {
    setErrorMessage(undefined);
    const event: PlayerCreated = {
      type: EventTypeEnum.PLAYER_CREATED,
      time: Date.now(),
      stream: playerId,
      data: { name: playerName },
    };

    const validateResponse = context.eventStore.playersProjector.validateCreatePlayer(event);
    if (validateResponse.valid === false) {
      setErrorMessage(validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        setCurrentStep(3);
      },
      onError(error) {
        setErrorMessage(error.message);
      },
    });
  }

  const canProceed = currentStep === 1 ? nameIsValid : understandsPermanent;

  return (
    // Fixed column from the nav's bottom edge to the keyboard's top edge: the
    // page never adds document scroll, the indicator and the navigator stay
    // visible, and only the middle scrolls. top matches the nav's MENU_HEIGHT.
    <div className="fixed inset-x-0 top-16 md:top-12 flex flex-col" style={{ bottom: keyboardInset }}>
      <div className="shrink-0 pt-4">
        <StepIndicator steps={ADD_PLAYER_STEPS} currentStep={currentStep} />
      </div>
      {/* The player exists on step 3, so the step itself is the success. */}
      {currentStep === 3 && (
        <div className="flex justify-center">
          <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={4_000} />
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto py-4 px-2 xs:px-4">
        {currentStep === 1 && (
          <StepPlayerName
            playerName={playerName}
            setPlayerName={setPlayerName}
            errorMessage={nameError}
            onSubmit={() => nameIsValid && setCurrentStep(2)}
          />
        )}
        {currentStep === 2 && (
          <div className="space-y-4">
            <StepPlayerColor
              playerName={playerName}
              playerId={playerId}
              colorOptions={colorOptions}
              selectColor={selectColor}
              understandsPermanent={understandsPermanent}
              setUnderstandsPermanent={setUnderstandsPermanent}
            />
            {errorMessage && (
              <p className="max-w-md mx-auto text-sm text-red-600 bg-white px-3 py-2 rounded-md border border-red-900/50">
                {errorMessage}
              </p>
            )}
          </div>
        )}
        {currentStep === 3 && (
          <StepPlayerPhoto
            playerName={playerName}
            playerId={playerId}
            onUploaded={() => navigate(`/player/${playerId}`)}
            onSkip={() => navigate(`/player/${playerId}`)}
          />
        )}
      </div>

      {/* The name and the color are locked after the player exists, so the
          photo step navigates on its own. */}
      {currentStep < 3 && (
        <div className="p-6 bg-secondary-background shrink-0">
          <div className="flex space-x-3">
            {currentStep === 2 && (
              <button
                onClick={() => setCurrentStep(1)}
                disabled={addEventMutation.isPending}
                className="text-primary-text flex-1 py-3 px-4 bg-primary-background hover:bg-primary-background/80 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                <span>← Back</span>
              </button>
            )}
            <button
              onClick={() => (currentStep === 1 ? setCurrentStep(2) : createPlayer())}
              disabled={!canProceed || addEventMutation.isPending}
              className={classNames(
                "flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors ring-1 ring-primary-background",
                canProceed && !addEventMutation.isPending
                  ? "bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/75"
                  : "bg-tertiary-background/50 text-tertiary-text/50 cursor-not-allowed",
              )}
            >
              {currentStep === 1 && <span>Next →</span>}
              {currentStep === 2 &&
                (addEventMutation.isPending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating player...</span>
                  </>
                ) : (
                  <span>✓ Create {playerName}</span>
                ))}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
