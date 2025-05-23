import { useEffect, useState } from "react";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { StepSelectPlayers } from "./step-select-players";
import { StepIndicator } from "./step-indicator";
import { StepNavigator } from "./step-navigator";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { StepSelectWinner } from "./step-select-winner";
import { StepAddScore } from "./step-add-score";
import { EventTypeEnum, GameCreated } from "../../client/client-db/event-store/event-types";
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
  const [gameSuccessfullyAdded, setGameSuccessfullyAdded] = useState(false);

  const canProceed = (fromStep: number) => {
    switch (fromStep) {
      case 1:
        return !!player1 && !!player2;
      case 2:
        return !!winner;
      case 3:
        return true; // Score is optional
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

  function submitGame(winner: string, loser: string) {
    const now = Date.now();
    const event: GameCreated = {
      type: EventTypeEnum.GAME_CREATED,
      time: now,
      stream: newId(),
      data: { winner, loser, playedAt: now },
    };

    const validateResponse = context.eventStore.gamesProjector.validateCreateGame(event);
    if (validateResponse.valid === false) {
      console.error(validateResponse.message);
      return;
    }

    const isPendingTournamentGame = context.tournaments.findAllPendingGames(winner, loser);

    addEventMutation.mutate(event, {
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
  }

  useEffect(() => {
    if (winner && winner !== player1 && winner !== player2) {
      setWinner(null);
    }
  }, [winner, player1, player2]);

  return (
    <div>
      NOTE: UI preview. Updates will come soon
      <StepIndicator currentStep={currentStep} />
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
        <StepAddScore player1={player1} player2={player2} winner={winner} />
      )}
      <StepNavigator
        canProceed={canProceed(currentStep)}
        currentStep={currentStep}
        handleNext={handleNext}
        handleBack={handleBack}
        handleSubmit={() => {
          if (!player1 || !player2 || !winner) return;
          const loser = player1 === winner ? player2 : player1;
          submitGame(winner, loser);

          console.log({
            player1: context.playerName(player1),
            player2: context.playerName(player2),
            winner: context.playerName(winner),
          });
        }}
        isSubmitting={addEventMutation.isPending}
      />
      {gameSuccessfullyAdded && <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />}
    </div>
  );
};
