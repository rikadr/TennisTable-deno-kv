import { Link, useNavigate } from "react-router-dom";
import { session } from "../../services/auth";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { useEventMutation } from "../../hooks/use-event-mutation";
import { queryClient } from "../../common/query-client";
import { newId } from "../../common/nani-id";
import { EventTypeEnum, TournamentCreated } from "../../client/client-db/event-store/event-types";
import { TournamentForm, TournamentFormData, datetimeLocalToTimestamp } from "./tournament-form";

export const NewTournamentPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const addEventMutation = useEventMutation();

  const isAdmin = session.sessionData?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="max-w-96 mx-4 md:mx-10 space-y-4 text-primary-text">
        <h1>New tournament</h1>
        <p>Only admins can create tournaments. Log in as an admin to continue.</p>
        <Link to="/tournament/list" className="inline-block mt-4 text-sm text-primary-text hover:underline">
          &larr; Back to tournaments
        </Link>
      </div>
    );
  }

  function handleSubmit(data: TournamentFormData) {
    const tournamentId = newId();
    const event: TournamentCreated = {
      type: EventTypeEnum.TOURNAMENT_CREATED,
      time: Date.now(),
      stream: tournamentId,
      data: {
        name: data.name,
        description: data.description || undefined,
        startDate: datetimeLocalToTimestamp(data.startDate),
        groupPlay: data.groupPlay,
      },
    };

    const validateResponse = context.eventStore.tournamentsProjector.validateCreateTournament(event);
    if (validateResponse.valid === false) {
      alert(validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        navigate(`/tournament?tournament=${tournamentId}`);
      },
    });
  }

  return (
    <div className="max-w-lg mx-4 md:mx-10 space-y-4 text-primary-text">
      <div className="flex items-center justify-between gap-4">
        <h1>New tournament</h1>
        <Link to="/tournament/list" className="text-sm text-primary-text/70 hover:underline">
          &larr; Back
        </Link>
      </div>

      <div className="ring-1 ring-secondary-background rounded-lg p-4 md:p-6 bg-primary-background">
        <TournamentForm onSubmit={handleSubmit} submitLabel="Create tournament" isPending={addEventMutation.isPending} />
      </div>
    </div>
  );
};
