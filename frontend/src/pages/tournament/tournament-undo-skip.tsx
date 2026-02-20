import { useState } from "react";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { EventTypeEnum, TournamentUndoSkipGame } from "../../client/client-db/event-store/event-types";
import { useEventMutation } from "../../hooks/use-event-mutation";
import { useNavigate, useLocation, Link, useSearchParams } from "react-router-dom";
import { queryClient } from "../../common/query-client";
import ConfettiExplosion from "react-confetti-explosion";
import { classNames } from "../../common/class-names";

export const TournamentUndoSkipPage = () => {
  const { tournament: tournamentId, player1, player2 } = useTennisParams();
  const [searchParams] = useSearchParams();
  const skipId = searchParams.get("skipId");
  const context = useEventDbContext();
  const tournament = context.tournaments.getTournament(tournamentId);
  const addEventMutation = useEventMutation();
  const navigate = useNavigate();
  const location = useLocation();
  const [undoSuccessfullyAdded, setUndoSuccessfullyAdded] = useState(false);

  if (!tournamentId || !tournament || !player1 || !player2 || !skipId) {
    return (
      <div className="p-4">
        <p className="text-tertiary-text">Missing tournament, player, or skip information.</p>
        <Link to="/tournament/list" className="text-primary-text">
          Back to Tournaments
        </Link>
      </div>
    );
  }

  async function submitUndo(skipId: string, tournamentId: string) {
    const now = Date.now();
    const undoSkipEvent: TournamentUndoSkipGame = {
      type: EventTypeEnum.TOURNAMENT_UNDO_SKIP_GAME,
      time: now,
      stream: tournamentId,
      data: { skipId },
    };

    const validateUndo = context.eventStore.tournamentsProjector.validateUndoSkipGame(undoSkipEvent);
    if (validateUndo.valid === false) {
      console.error(validateUndo.message);
      alert(`Error: ${validateUndo.message}`);
      return;
    }

    await addEventMutation.mutateAsync(undoSkipEvent, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        setUndoSuccessfullyAdded(true);
        setTimeout(() => {
          navigate(`/tournament${location.search}`);
        }, 2_000);
      },
    });
  }

  const isSubmitting = addEventMutation.isPending;

  return (
    <div className="p-4 max-w-xl m-auto">
      {undoSuccessfullyAdded && (
        <div className="flex justify-center">
          <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />
        </div>
      )}

      <h1 className="text-2xl font-bold text-primary-text mb-2">Undo Skip Game</h1>
      <p className="text-primary-text/80 mb-6">Confirm that you want to undo this walkover</p>

      <div className="bg-secondary-background rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-secondary-text">{tournament.name}</h2>
        {tournament.description && <p className="text-tertiary-text">{tournament.description}</p>}
      </div>

      <h3 className="font-semibold text-primary-text mb-4">Players:</h3>

      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-4 p-4 rounded-lg bg-primary-background">
          <ProfilePicture playerId={player1} border={4} size={48} />
          <h2 className="font-semibold text-primary-text">{context.playerName(player1)}</h2>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg bg-primary-background">
          <ProfilePicture playerId={player2} border={4} size={48} />
          <h2 className="font-semibold text-primary-text">{context.playerName(player2)}</h2>
        </div>
      </div>

      <div className="bg-tertiary-background rounded-lg p-4 mb-6">
        <p className="text-tertiary-text">⚠️ This will remove the walkover result and restore the game as unplayed.</p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => submitUndo(skipId, tournamentId)}
          disabled={isSubmitting}
          className={classNames(
            "flex-1 px-6 py-3 rounded-lg font-semibold",
            isSubmitting
              ? "bg-tertiary-background text-tertiary-text cursor-not-allowed"
              : "bg-secondary-background text-secondary-text hover:opacity-90",
          )}
        >
          {isSubmitting ? "Undoing..." : "⏮️ Confirm Undo Skip"}
        </button>

        <Link
          to={`/tournament${location.search}`}
          className="px-6 py-3 rounded-lg font-semibold text-primary-text bg-primary-background hover:bg-secondary-background/50"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
};
