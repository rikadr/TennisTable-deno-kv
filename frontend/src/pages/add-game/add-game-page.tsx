import { useEffect, useState } from "react";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { StepSelectPlayers } from "./step-select-players";
import { StepIndicator } from "../../common/step-indicator";
import { StepNavigator } from "./step-navigator";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { StepSelectWinner } from "./step-select-winner";
import { StepAddScore } from "./step-add-score";
import { EMPTY_SCORE_DRAFT, ScoreDraft, scoreDraftIssues, scoreDraftToEventData } from "../../common/score-draft";
import { EventTypeEnum, GameCreated, GameScore } from "../../client/client-db/event-store/event-types";
import { newId } from "../../common/nani-id";
import { useEventMutation } from "../../hooks/use-event-mutation";
import { queryClient } from "../../common/query-client";
import { useNavigate } from "react-router-dom";
import ConfettiExplosion from "react-confetti-explosion";
import { useKeyboardInset } from "../../hooks/use-keyboard-inset";

export const ADD_GAME_STEPS = [
  { step: 1, title: "Select Players", icon: "👥" },
  { step: 2, title: "Choose Winner", icon: "🏆" },
  { step: 3, title: "Add Score", icon: "📊" },
] as const;

export const AddGamePageV2: React.FC = () => {
  const context = useEventDbContext();
  const addEventMutation = useEventMutation();
  const navigate = useNavigate();
  const keyboardInset = useKeyboardInset();

  const params = useTennisParams();
  const [player1, setPlayer1] = useState(params.player1);
  const [player2, setPlayer2] = useState(params.player2);
  const [winner, setWinner] = useState<string | null>(null);
  // From the game winner's perspective, so it starts again when the winner changes.
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>(EMPTY_SCORE_DRAFT);
  const [gameSuccessfullyAdded, setGameSuccessfullyAdded] = useState(false);
  const [validationError, setValidationError] = useState("");

  const canProceed = (fromStep: number) => {
    switch (fromStep) {
      case 1:
        return !!player1 && !!player2;
      case 2:
        return !!winner;
      case 3:
        return scoreDraftIssues(scoreDraft).length === 0;
      default:
        return false;
    }
  };

  const [currentStep, setCurrentStep] = useState(canProceed(1) ? 2 : 1);

  const handleNext = () => {
    if (canProceed(currentStep) && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  async function submitGame(winner: string, loser: string) {
    setValidationError("");
    const now = Date.now();
    const gameCreatedEvent: GameCreated = {
      type: EventTypeEnum.GAME_CREATED,
      time: now,
      stream: newId(),
      data: { winner, loser, playedAt: now },
    };

    const validateCreated = context.eventStore.gamesProjector.validateCreateGame(gameCreatedEvent);
    if (validateCreated.valid === false) {
      console.error(validateCreated.message);
      setValidationError(validateCreated.message);
      return;
    }

    const scoreData = scoreDraftToEventData(scoreDraft);
    const gameScoreEvent: GameScore | null = scoreData && {
      type: EventTypeEnum.GAME_SCORE,
      time: gameCreatedEvent.time + 1,
      stream: gameCreatedEvent.stream,
      data: scoreData,
    };

    if (gameScoreEvent) {
      const validateScore = context.eventStore.gamesProjector.validateScoreGame(gameScoreEvent);
      if (validateScore.valid === false) {
        console.error(validateScore.message);
        setValidationError(validateScore.message);
        return;
      }
    }

    const isPendingTournamentGame = context.tournaments.findAllPendingGames(winner, loser);

    async function onSuccess() {
      queryClient.invalidateQueries();
      setGameSuccessfullyAdded(true);
      setTimeout(() => {
        navigate(
          isPendingTournamentGame.length > 0
            ? `/tournament?tournament=${isPendingTournamentGame[0].tournament.id}&player1=${isPendingTournamentGame[0].player1}&player2=${isPendingTournamentGame[0].player2}`
            : `/1v1/?player1=${winner}&player2=${loser}`,
        );
      }, 2_000);
    }

    if (gameScoreEvent) {
      await addEventMutation.mutateAsync(gameCreatedEvent);
      await addEventMutation.mutateAsync(gameScoreEvent, {
        onSuccess,
      });
    } else {
      await addEventMutation.mutateAsync(gameCreatedEvent, {
        onSuccess,
      });
    }
  }

  useEffect(() => {
    if (winner && winner !== player1 && winner !== player2) {
      setWinner(null);
    }

    setScoreDraft(EMPTY_SCORE_DRAFT);
    setValidationError("");
  }, [winner, player1, player2]);

  useEffect(() => {
    if (currentStep === 1 && player1 && player2) {
      handleNext();
    }
    setWinner(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player1, player2]);

  return (
    // Fixed column from the nav's bottom edge to the keyboard's top edge: the
    // page never adds document scroll, the indicator and the navigator stay
    // visible, and only the middle scrolls. top matches the nav's MENU_HEIGHT.
    <div className="fixed inset-x-0 top-16 md:top-12 flex flex-col" style={{ bottom: keyboardInset }}>
      <div className="shrink-0 pt-4">
        <StepIndicator steps={ADD_GAME_STEPS} currentStep={currentStep} />
      </div>
      {gameSuccessfullyAdded && (
        <div className="flex justify-center">
          <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto py-2 px-2 xs:px-4">
        {currentStep === 1 && (
          <StepSelectPlayers player1={{ id: player1, set: setPlayer1 }} player2={{ id: player2, set: setPlayer2 }} />
        )}
        {currentStep === 2 && player1 && player2 && (
          <StepSelectWinner
            player1={player1}
            player2={player2}
            winner={winner}
            onWinnerSelect={(playerId) => setWinner(playerId)}
          />
        )}
        {currentStep === 3 && player1 && player2 && winner && (
          <StepAddScore
            winner={winner}
            loser={winner === player1 ? player2 : player1}
            draft={scoreDraft}
            onChange={setScoreDraft}
          />
        )}
        {validationError && (
          <p className="max-w-xl mx-auto mt-3 rounded-lg px-3 py-2 text-sm bg-red-100 text-red-800">
            Error: {validationError}
          </p>
        )}
      </div>
      <StepNavigator
        canProceed={canProceed(currentStep)}
        currentStep={currentStep}
        handleNext={handleNext}
        handleBack={handleBack}
        handleSubmit={() => {
          if (!player1 || !player2 || !winner) return;
          const loser = player1 === winner ? player2 : player1;
          submitGame(winner, loser);
        }}
        isSubmitting={addEventMutation.isPending}
        hasSubmitted={gameSuccessfullyAdded}
      />
    </div>
  );
};
