import { useEffect, useState } from "react";
import { classNames } from "../common/class-names";
import { useTennisParams } from "../hooks/use-tennis-params";
import { useEventDbContext } from "../wrappers/event-db-context";
import { ManualSetPoints, StepAddScore } from "./add-game/step-add-score";
import { EventTypeEnum, GameScore } from "../client/client-db/event-store/event-types";
import { badSideOfGameWinnerSide, gameWinnerSideOfBadSide } from "../common/table-sides";
import { useEventMutation } from "../hooks/use-event-mutation";
import { queryClient } from "../common/query-client";
import { useNavigate } from "react-router-dom";
import ConfettiExplosion from "react-confetti-explosion";
import { useKeyboardInset } from "../hooks/use-keyboard-inset";

export const EditGameSore: React.FC = () => {
  const context = useEventDbContext();
  const addEventMutation = useEventMutation();
  const navigate = useNavigate();
  const keyboardInset = useKeyboardInset();
  const { gameId } = useTennisParams();
  const game = context.eventStore.gamesProjector.getGameById(gameId);

  const [winnerSets, setWinnerSets] = useState(game?.score?.setsWon.gameWinner ?? 0);
  const [loserSets, setLoserSets] = useState(game?.score?.setsWon.gameLoser ?? 0);
  // Player 1 of the form is the game winner, so the winner's side decodes
  // against slot 1. The sides list covers every set, with or without points.
  const [setPoints, setSetPoints] = useState<ManualSetPoints[]>(() => {
    const totalSets = (game?.score?.setsWon.gameWinner ?? 0) + (game?.score?.setsWon.gameLoser ?? 0);
    return Array.from({ length: totalSets }, (_, index) => ({
      player1: game?.score?.setPoints?.[index]?.gameWinner,
      player2: game?.score?.setPoints?.[index]?.gameLoser,
      badSide: badSideOfGameWinnerSide(game?.score?.gameWinnerSides?.[index], 1),
    }));
  });
  const [validationError, setValidationError] = useState("");

  const invalidScore = (winnerSets === loserSets && winnerSets > 0) || loserSets > winnerSets;
  // The form has no point-level detail, so an edit can only keep the stored
  // point-by-point log while the sets and points it describes are unchanged.
  // An edit that only changes the sides keeps the log of a tracked game.
  const pointDataUnchanged =
    winnerSets === game?.score?.setsWon.gameWinner &&
    loserSets === game?.score?.setsWon.gameLoser &&
    setPoints.every(
      ({ player1, player2 }, index) =>
        game.score?.setPoints?.[index]?.gameWinner === player1 && game.score?.setPoints?.[index]?.gameLoser === player2,
    );
  const unchangedScore =
    pointDataUnchanged &&
    setPoints.every(
      ({ badSide }, index) => (game?.score?.gameWinnerSides?.[index] ?? null) === gameWinnerSideOfBadSide(badSide, 1),
    );

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

    // The sides are independent of the points: only the sets won are needed.
    const sidesAreSet = setPoints.some((set) => set.badSide !== null);

    const gameScoreEvent: GameScore = {
      type: EventTypeEnum.GAME_SCORE,
      time: now,
      stream: game.id,
      data: {
        setsWon: { gameWinner: winnerSets, gameLoser: loserSets },
        setPoints: setPointsAreSet
          ? setPoints.map((set) => ({ gameWinner: set.player1!, gameLoser: set.player2! }))
          : undefined,
        gameWinnerSides: sidesAreSet ? setPoints.map((set) => gameWinnerSideOfBadSide(set.badSide, 1)) : undefined,
        pointSequences: pointDataUnchanged ? game.score?.pointSequences : undefined,
        tracking: pointDataUnchanged ? game.score?.tracking : undefined,
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
      const newSets = new Array<ManualSetPoints>(setsAdded).fill({
        player1: undefined,
        player2: undefined,
        badSide: null,
      });
      setSetPoints((prev) => [...prev, ...newSets]);
    } else if (setPoints.length > totalSets) {
      // Set removed
      const setsRemoved = setPoints.length - totalSets;

      setSetPoints((prev) => prev.slice(0, prev.length - setsRemoved));
    }
  }, [winnerSets, loserSets, setPoints.length]);

  // Editing replaces the score event. The stored point-by-point log survives
  // only while the sets and points are unchanged, so warn when they are not.
  const hasPointSequences = (game?.score?.pointSequences?.length ?? 0) > 0;
  const discardsPointLog = hasPointSequences && pointDataUnchanged === false;

  if (!game) return null;
  return (
    // Fixed column from the nav's bottom edge to the keyboard's top edge: the
    // page never adds document scroll, the buttons stay visible, and only the
    // middle scrolls. top matches the nav's MENU_HEIGHT.
    <div className="fixed inset-x-0 top-16 md:top-12 flex flex-col" style={{ bottom: keyboardInset }}>
      {addEventMutation.isSuccess && (
        <div className="flex justify-center">
          <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto py-8 px-2 xs:px-4">
        <StepAddScore
          player1={{ id: game.winner, sets: winnerSets, setSets: setWinnerSets }}
          player2={{ id: game.loser, sets: loserSets, setSets: setLoserSets }}
          setPoints={{ setPoints, setSetPoints }}
          winner={game.winner}
          invalidScore={invalidScore}
        />

        {validationError && <div className="bg-black text-red-500 text-center">Error: {validationError}</div>}
      </div>
      <div className="p-6 bg-secondary-background shrink-0">
        {discardsPointLog && (
          <div className="mb-3 p-3 bg-amber-100 border border-amber-400 text-amber-800 rounded-lg text-sm">
            ⚠️ This game was tracked live, point by point. If you save a changed score, the point-by-point data of this
            game is discarded. A change to only the table sides keeps it.
          </div>
        )}
        <div className="flex space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 py-3 px-4 bg-primary-background hover:bg-primary-background/30 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors"
          >
            <span>Cancel</span>
          </button>

          <button
            onClick={!addEventMutation.isPending ? submitScore : undefined}
            disabled={unchangedScore || invalidScore || addEventMutation.isPending || addEventMutation.isSuccess}
            className={classNames(
              "flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors",
              !unchangedScore && !invalidScore && !addEventMutation.isPending && !addEventMutation.isSuccess
                ? "bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/75"
                : "bg-tertiary-background/30 text-tertiary-text/50 cursor-not-allowed",
            )}
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
