import { useState } from "react";
import { classNames } from "../common/class-names";
import { useTennisParams } from "../hooks/use-tennis-params";
import { useEventDbContext } from "../wrappers/event-db-context";
import { StepAddScore } from "./add-game/step-add-score";
import { EventTypeEnum, GameScore } from "../client/client-db/event-store/event-types";
import { gameWinnerSideOfBadSide } from "../common/table-sides";
import {
  hasResult,
  ScoreDraft,
  scoreDraftIssues,
  scoreDraftOfGameScore,
  scoreDraftToEventData,
} from "../common/score-draft";
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

  const [draft, setDraft] = useState<ScoreDraft>(() => scoreDraftOfGameScore(game?.score));
  const [validationError, setValidationError] = useState("");

  const invalidScore = hasResult(draft) === false || scoreDraftIssues(draft).length > 0;
  // The form has no point-level detail, so an edit can only keep the stored
  // point-by-point log while the sets and points it describes are unchanged.
  // An edit that only changes the sides keeps the log of a tracked game.
  const pointDataUnchanged =
    draft.winnerSets === game?.score?.setsWon.gameWinner &&
    draft.loserSets === game?.score?.setsWon.gameLoser &&
    draft.sets.every(
      ({ player1, player2 }, index) =>
        game.score?.setPoints?.[index]?.gameWinner === player1 && game.score?.setPoints?.[index]?.gameLoser === player2,
    );
  const unchangedScore =
    pointDataUnchanged &&
    draft.sets.every(
      ({ badSide }, index) => (game?.score?.gameWinnerSides?.[index] ?? null) === gameWinnerSideOfBadSide(badSide, 1),
    );

  async function submitScore() {
    setValidationError("");
    const now = Date.now();

    if (!game) {
      setValidationError("Cant find game.");
      return;
    }

    const scoreData = scoreDraftToEventData(draft);
    if (scoreData === null) {
      setValidationError("Select the sets won.");
      return;
    }

    const gameScoreEvent: GameScore = {
      type: EventTypeEnum.GAME_SCORE,
      time: now,
      stream: game.id,
      data: {
        ...scoreData,
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
      <div className="flex-1 min-h-0 overflow-y-auto py-4 px-2 xs:px-4">
        <StepAddScore winner={game.winner} loser={game.loser} draft={draft} onChange={setDraft} optional={false} />

        {validationError && (
          <p className="max-w-xl mx-auto mt-3 rounded-lg px-3 py-2 text-sm bg-red-100 text-red-800">
            Error: {validationError}
          </p>
        )}
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
