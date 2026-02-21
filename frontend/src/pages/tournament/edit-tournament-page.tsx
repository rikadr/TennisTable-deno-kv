import { Link, useNavigate } from "react-router-dom";
import { session } from "../../services/auth";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { useEventMutation } from "../../hooks/use-event-mutation";
import { queryClient } from "../../common/query-client";
import {
  EventTypeEnum,
  TournamentDeleted,
  TournamentUpdated,
} from "../../client/client-db/event-store/event-types";
import { TournamentForm, TournamentFormData, datetimeLocalToTimestamp, timestampToDatetimeLocal } from "./tournament-form";
import { useTennisParams } from "../../hooks/use-tennis-params";

export const EditTournamentPage: React.FC = () => {
  const { tournament: tournamentId } = useTennisParams();
  const context = useEventDbContext();
  const navigate = useNavigate();
  const addEventMutation = useEventMutation();

  const isAdmin = session.sessionData?.role === "admin";
  const tournament = context.tournaments.getTournament(tournamentId);

  if (!isAdmin) {
    return (
      <div className="max-w-96 mx-4 md:mx-10 space-y-4 text-primary-text">
        <h1>Edit tournament</h1>
        <p>Only admins can edit tournaments. Log in as an admin to continue.</p>
        <Link to="/tournament/list" className="inline-block mt-4 text-sm text-primary-text hover:underline">
          &larr; Back to tournaments
        </Link>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-96 mx-4 md:mx-10 space-y-4 text-primary-text">
        <h1>Edit tournament</h1>
        <p>Tournament not found.</p>
        <Link to="/tournament/list" className="inline-block mt-4 text-sm text-primary-text hover:underline">
          &larr; Back to tournaments
        </Link>
      </div>
    );
  }

  const hasStarted = tournament.startDate <= Date.now();

  function handleSubmit(data: TournamentFormData) {
    if (!tournament) return;

    const updateData: TournamentUpdated["data"] = {};
    if (data.name !== tournament.name) updateData.name = data.name;
    if ((data.description || undefined) !== tournament.description) updateData.description = data.description || undefined;
    if (!hasStarted) {
      const newStartDate = datetimeLocalToTimestamp(data.startDate);
      if (newStartDate !== tournament.startDate) updateData.startDate = newStartDate;
      if (data.groupPlay !== tournament.tournamentDb.groupPlay) updateData.groupPlay = data.groupPlay;
    }

    if (Object.keys(updateData).length === 0) {
      navigate(`/tournament?tournament=${tournament.id}`);
      return;
    }

    const event: TournamentUpdated = {
      type: EventTypeEnum.TOURNAMENT_UPDATED,
      time: Date.now(),
      stream: tournament.id,
      data: updateData,
    };

    const validateResponse = context.eventStore.tournamentsProjector.validateUpdateTournament(event);
    if (validateResponse.valid === false) {
      alert(validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        navigate(`/tournament?tournament=${tournament.id}`);
      },
    });
  }

  function handleDelete() {
    if (!tournament) return;
    if (!window.confirm(`Are you sure you want to delete "${tournament.name}"? This cannot be undone.`)) return;

    const event: TournamentDeleted = {
      type: EventTypeEnum.TOURNAMENT_DELETED,
      time: Date.now(),
      stream: tournament.id,
      data: null,
    };

    const validateResponse = context.eventStore.tournamentsProjector.validateDeleteTournament(event);
    if (validateResponse.valid === false) {
      alert(validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, {
      onSuccess: () => {
        queryClient.invalidateQueries();
        navigate("/tournament/list");
      },
    });
  }

  return (
    <div className="max-w-lg mx-4 md:mx-10 space-y-4 text-primary-text">
      <div className="flex items-center justify-between gap-4">
        <h1>Edit tournament</h1>
        <Link
          to={`/tournament?tournament=${tournament.id}`}
          className="text-sm text-primary-text/70 hover:underline"
        >
          &larr; Back
        </Link>
      </div>

      <div className="ring-1 ring-secondary-background rounded-lg p-4 md:p-6 bg-primary-background">
        <TournamentForm
          initialData={{
            name: tournament.name,
            description: tournament.description ?? "",
            startDate: timestampToDatetimeLocal(tournament.startDate),
            groupPlay: tournament.tournamentDb.groupPlay,
          }}
          onSubmit={handleSubmit}
          submitLabel="Save changes"
          isPending={addEventMutation.isPending}
          lockedFields={hasStarted ? { startDate: true, groupPlay: true } : undefined}
        />
      </div>

      <div className="ring-1 ring-red-500/30 rounded-lg p-4 md:p-6 bg-primary-background">
        <h2 className="text-sm font-medium text-red-400 mb-2">Danger zone</h2>
        <p className="text-xs text-primary-text/60 mb-3">
          Deleting a tournament removes it from the list. This action cannot be undone.
        </p>
        <button
          onClick={handleDelete}
          disabled={addEventMutation.isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Delete tournament
        </button>
      </div>
    </div>
  );
};
