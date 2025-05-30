import { useEffect, useState } from "react";
import { useTennisParams } from "../hooks/use-tennis-params";
import { useEventDbContext } from "../wrappers/event-db-context";
import { StepAddScore } from "./add-game/step-add-score";
import { EventTypeEnum, GameScore } from "../client/client-db/event-store/event-types";
import { useEventMutation } from "../hooks/use-event-mutation";
import { queryClient } from "../common/query-client";
import { useNavigate } from "react-router-dom";
import ConfettiExplosion from "react-confetti-explosion";

export const EditGameSore: React.FC = () => {
  const context = useEventDbContext();
  const addEventMutation = useEventMutation();
  const navigate = useNavigate();
  const { gameId } = useTennisParams();
  const game = context.eventStore.gamesProjector.getGameById(gameId);

  const [winnerSets, setWinnerSets] = useState(game?.score?.setsWon.gameWinner ?? 0);
  const [loserSets, setLoserSets] = useState(game?.score?.setsWon.gameLoser ?? 0);
  const [setPoints, setSetPoints] = useState<{ player1?: number; player2?: number }[]>(
    game?.score?.setPoints?.map(({ gameWinner, gameLoser }) => ({ player1: gameWinner, player2: gameLoser })) ?? [],
  );
  const [validationError, setValidationError] = useState("");

  const invalidScore = (winnerSets === loserSets && winnerSets > 0) || loserSets > winnerSets;

  async function submitScore() {
    setValidationError("");
    const now = Date.now();

    if (!game) {
      setValidationError("Cant find game.");
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
      time: now,
      stream: game.id,
      data: {
        setsWon: { gameWinner: winnerSets, gameLoser: loserSets },
        setPoints: setPointsAreSet
          ? setPoints.map((set) => ({ gameWinner: set.player1!, gameLoser: set.player2! }))
          : undefined,
      },
    };

    const validateScore = context.eventStore.gamesProjector.validateScoreGame(gameScoreEvent);
    if (validateScore.valid === false) {
      console.error(validateScore.message);
      setValidationError(validateScore.message);
      return;
    }

    async function onSuccess() {
      queryClient.invalidateQueries();
      setTimeout(() => {
        navigate(game ? `/1v1/?player1=${game.winner}&player2=${game.loser}` : "/");
      }, 2_000);
    }

    await addEventMutation.mutateAsync(gameScoreEvent, {
      onSuccess,
    });
  }

  useEffect(() => {
    const totalSets = winnerSets + loserSets;
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
  }, [winnerSets, loserSets, setPoints.length]);

  if (!game) return null;
  return (
    <div>
      {addEventMutation.isSuccess && (
        <div className="flex justify-center">
          <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />
        </div>
      )}
      <div
        className="overflow-y-auto py-8 px-2 xs:px-4 h-16"
        style={{
          height: `calc(100dvh - 160.1px - 48px)`,
          ...(window.innerWidth <= 768 && {
            height: `calc(100dvh - 160.1px - 64px)`,
          }),
        }}
      >
        <StepAddScore
          player1={{ id: game.winner, sets: winnerSets, setSets: setWinnerSets }}
          player2={{ id: game.loser, sets: loserSets, setSets: setLoserSets }}
          setPoints={{ setPoints, setSetPoints }}
          winner={game.winner}
          invalidScore={invalidScore}
        />

        {validationError && <div className="bg-black text-red-500 text-center">Error: {validationError}</div>}
      </div>
      <div className="p-6 bg-secondary-background">
        <div className="flex space-x-3">
          <button
            onClick={() => navigate("/")}
            className="flex-1 py-3 px-4 bg-primary-background hover:bg-primary-background/30 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors"
          >
            <span>Cancel</span>
          </button>

          <button
            onClick={!addEventMutation.isPending ? submitScore : undefined}
            disabled={invalidScore || addEventMutation.isPending || addEventMutation.isSuccess}
            className={`
                  flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors
                  ${
                    !invalidScore && !addEventMutation.isPending && !addEventMutation.isSuccess
                      ? "bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/75"
                      : "bg-tertiary-background/30 text-tertiary-text/50 cursor-not-allowed"
                  }
                `}
          >
            {addEventMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Adding Game...</span>
              </>
            ) : (
              <>
                <span>{addEventMutation.isSuccess ? "✓ Success" : "✓ Edit score"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
