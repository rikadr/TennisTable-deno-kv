import { useEffect, useState } from "react";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { StepSelectPlayers } from "./step-select-players";
import { StepIndicator } from "./step-indicator";
import { StepNavigator } from "./step-navigator";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { StepSelectWinner } from "./step-select-winner";
import { StepAddScore } from "./step-add-score";
import { EventTypeEnum, GameCreated, GameScore } from "../../client/client-db/event-store/event-types";
import { newId } from "../../common/nani-id";
import { useEventMutation } from "../../hooks/use-event-mutation";
import { queryClient } from "../../common/query-client";
import { useNavigate } from "react-router-dom";
import ConfettiExplosion from "react-confetti-explosion";

export const ADD_GAME_STEPS = [
  { step: 1, title: "Select Players", icon: "👥" },
  { step: 2, title: "Choose Winner", icon: "🏆" },
  { step: 3, title: "Add Score", icon: "📊" },
] as const;

export const AddGamePageV2: React.FC = () => {
  const context = useEventDbContext();
  const addEventMutation = useEventMutation();
  const navigate = useNavigate();

  const params = useTennisParams();
  const [player1, setPlayer1] = useState(params.player1);
  const [player2, setPlayer2] = useState(params.player2);
  const [winner, setWinner] = useState<string | null>(null);
  const [player1Sets, setPlayer1Sets] = useState(0);
  const [player2Sets, setPlayer2Sets] = useState(0);
  const [setPoints, setSetPoints] = useState<{ player1?: number; player2?: number }[]>([]);
  const [gameSuccessfullyAdded, setGameSuccessfullyAdded] = useState(false);
  const [validationError, setValidationError] = useState("");

  const invalidScore =
    (player1Sets === player2Sets && player1Sets > 0) ||
    (winner === player1 && player2Sets > player1Sets) ||
    (winner === player2 && player1Sets > player2Sets);

  const canProceed = (fromStep: number) => {
    switch (fromStep) {
      case 1:
        return !!player1 && !!player2;
      case 2:
        return !!winner;
      case 3:
        return invalidScore === false;
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

    const setPointsAreSet = setPoints.some((set) => set.player1 !== undefined || set.player2 !== undefined);
    const allSetPointsAreSet = setPoints.every((set) => set.player1 !== undefined && set.player2 !== undefined);
    if (setPointsAreSet && allSetPointsAreSet === false) {
      setValidationError("Missing some individual set points. Either add the missing or remove all.");
      return;
    }

    const gameScoreEvent: GameScore = {
      type: EventTypeEnum.GAME_SCORE,
      time: gameCreatedEvent.time + 1,
      stream: gameCreatedEvent.stream,
      data: {
        setsWon: {
          gameWinner: player1 === winner ? player1Sets : player2Sets,
          gameLoser: player1 === winner ? player2Sets : player1Sets,
        },
        setPoints: setPointsAreSet
          ? setPoints.map((set) => ({
              gameWinner: player1 === winner ? set.player1! : set.player2!,
              gameLoser: player1 === winner ? set.player2! : set.player1!,
            }))
          : undefined,
      },
    };

    const recordScores = gameScoreEvent.data.setsWon.gameWinner > 0 || gameScoreEvent.data.setsWon.gameLoser > 0;
    if (recordScores) {
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

    if (recordScores) {
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
    const totalSets = player1Sets + player2Sets;
    if (setPoints.length === totalSets) {
      return;
    } else if (setPoints.length < totalSets) {
      // Set added
      const setsAdded = totalSets - setPoints.length;
      const newSets = new Array<{ player1?: number; player2?: number }>(setsAdded).fill({
        player1: undefined,
        player2: undefined,
      });
      setSetPoints((prev) => [...prev, ...newSets]);
    } else if (setPoints.length > totalSets) {
      // Set removed
      const setsRemoved = setPoints.length - totalSets;

      setSetPoints((prev) => prev.slice(0, prev.length - setsRemoved));
    }
  }, [player1Sets, player2Sets, setPoints.length]);

  useEffect(() => {
    if (winner && winner !== player1 && winner !== player2) {
      setWinner(null);
    }

    setPlayer1Sets(0);
    setPlayer2Sets(0);
    setSetPoints([]);
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
    <div>
      <StepIndicator currentStep={currentStep} />
      {gameSuccessfullyAdded && (
        <div className="flex justify-center">
          <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />
        </div>
      )}
      <div
        className="overflow-y-auto py-2 px-2 xs:px-4 h-16"
        style={{
          height: `calc(100dvh - 160.1px - 48px)`,
          ...(window.innerWidth <= 768 && {
            height: `calc(100dvh - 160.1px - 64px)`,
          }),
        }}
      >
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
            player1={{ id: player1, sets: player1Sets, setSets: setPlayer1Sets }}
            player2={{ id: player2, sets: player2Sets, setSets: setPlayer2Sets }}
            setPoints={{ setPoints, setSetPoints }}
            winner={winner}
            invalidScore={invalidScore}
          />
        )}
        {validationError && <div className="bg-white text-red-500 text-center">Error: {validationError}</div>}
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
