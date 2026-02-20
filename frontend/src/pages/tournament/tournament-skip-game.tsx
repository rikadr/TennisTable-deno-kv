import { useState } from "react";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { classNames } from "../../common/class-names";
import { EventTypeEnum, TournamentSkipGame } from "../../client/client-db/event-store/event-types";
import { newId } from "../../common/nani-id";
import { useEventMutation } from "../../hooks/use-event-mutation";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { queryClient } from "../../common/query-client";
import ConfettiExplosion from "react-confetti-explosion";

export const TournamentSkipGamePage = () => {
  const { tournament: tournamentId, player1, player2 } = useTennisParams();
  const context = useEventDbContext();
  const tournament = context.tournaments.getTournament(tournamentId);
  const addEventMutation = useEventMutation();
  const navigate = useNavigate();
  const location = useLocation();
  const [skipSuccessfullyAdded, setSkipSuccessfullyAdded] = useState(false);
  const [winner, setWinner] = useState<string | undefined>();

  if (!tournamentId || !tournament || !player1 || !player2) {
    return (
      <div className="p-4">
        <p className="text-tertiary-text">Missing tournament or player information.</p>
        <Link to="/tournament/list" className="text-primary-text">
          Back to Tournaments
        </Link>
      </div>
    );
  }

  async function submitSkip(winner: string, loser: string, tournamentId: string) {
    const now = Date.now();
    const gameSkippedEvent: TournamentSkipGame = {
      type: EventTypeEnum.TOURNAMENT_SKIP_GAME,
      time: now,
      stream: tournamentId,
      data: { winner, loser, skipId: newId() },
    };

    const validateCreated = context.eventStore.tournamentsProjector.validateSkipGame(gameSkippedEvent);
    if (validateCreated.valid === false) {
      console.error(validateCreated.message);
      alert(`Error: ${validateCreated.message}`);
      return;
    }

    await addEventMutation.mutateAsync(gameSkippedEvent, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        setSkipSuccessfullyAdded(true);
        setTimeout(() => {
          navigate(`/tournament${location.search}`);
        }, 2_000);
      },
    });
  }

  const isSubmitting = addEventMutation.isPending;

  return (
    <div className="p-4 max-w-xl m-auto">
      {skipSuccessfullyAdded && (
        <div className="flex justify-center">
          <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />
        </div>
      )}

      <h1 className="text-2xl font-bold text-primary-text mb-2">Skip Game (Walkover)</h1>
      <p className="text-primary-text/80 mb-6">Select the winner of the walkover</p>

      <div className="bg-secondary-background rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-secondary-text">{tournament.name}</h2>
        {tournament.description && <p className="text-tertiary-text">{tournament.description}</p>}
      </div>

      <h3 className="font-semibold text-primary-text mb-4">Choose Winner:</h3>

      <div className="space-y-4 mb-6">
        <button
          onClick={() => setWinner(player1)}
          disabled={isSubmitting}
          className={classNames(
            "w-full flex items-center gap-4 p-4 rounded-lg ring ring-secondary-background",
            winner === player1 ? "bg-secondary-background" : "bg-primary-background hover:bg-secondary-background/50",
          )}
        >
          <ProfilePicture playerId={player1} border={4} size={48} />
          <h2 className="font-semibold text-primary-text">{context.playerName(player1)}</h2>
          {winner === player1 && <span className="ml-auto text-secondary-text">✓</span>}
        </button>

        <button
          onClick={() => setWinner(player2)}
          disabled={isSubmitting}
          className={classNames(
            "w-full flex items-center gap-4 p-4 rounded-lg ring ring-secondary-background",
            winner === player2 ? "bg-secondary-background" : "bg-primary-background hover:bg-secondary-background/50",
          )}
        >
          <ProfilePicture playerId={player2} border={4} size={48} />
          <h2 className="font-semibold text-primary-text">{context.playerName(player2)}</h2>
          {winner === player2 && <span className="ml-auto text-secondary-text">✓</span>}
        </button>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => {
            if (!winner) return;
            const loser = winner === player1 ? player2 : player1;
            submitSkip(winner, loser, tournamentId);
          }}
          disabled={!winner || isSubmitting}
          className={classNames(
            "flex-1 px-6 py-3 rounded-lg font-semibold",
            !winner || isSubmitting
              ? "bg-primary-background text-primary-text ring ring-secondary-background cursor-not-allowed"
              : "bg-secondary-background text-secondary-text hover:opacity-90",
          )}
        >
          {isSubmitting
            ? "Submitting..."
            : `${winner ? "Confirm: " + context.playerName(winner) + " wins on walkover" : "Select Winner"}`}
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
