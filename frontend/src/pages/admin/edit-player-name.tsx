import { useState } from "react";
import { EventTypeEnum, PlayerNameUpdated } from "../../client/client-db/event-store/event-types";
import { useEventMutation } from "../../hooks/use-event-mutation";
import { queryClient } from "../../common/query-client";
import { useEventDbContext } from "../../wrappers/event-db-context";

export const EditPlayerName: React.FC<{ playerId: string }> = ({ playerId }) => {
  const [isEdit, setIsEdit] = useState(false);
  const [newName, setNewName] = useState("");
  const [validationError, setValidationError] = useState("");
  const addEventMutation = useEventMutation();
  const context = useEventDbContext();

  async function handleUpdatePlayerName() {
    const event: PlayerNameUpdated = {
      type: EventTypeEnum.PLAYER_NAME_UPDATED,
      time: Date.now(),
      stream: playerId,
      data: { updatedName: newName },
    };

    const validateResponse = context.eventStore.playersReducer.validateUpdateName(event);
    if (validateResponse.valid === false) {
      setValidationError(validateResponse.message);
      return;
    }

    await addEventMutation.mutateAsync(event, { onSuccess: () => queryClient.invalidateQueries });
    setIsEdit(false);
  }

  return (
    <div className="flex gap-2">
      <button
        className="text-xs bg-secondary-background hover:bg-secondary-background/70 text-secondary-text px-1 rounded-md"
        onClick={() => {
          setIsEdit(!isEdit);
          setNewName(context.playerName(playerId));
        }}
      >
        {isEdit ? "Cancel edit" : "Edit name"}
      </button>
      {isEdit && (
        <>
          <input
            type="text"
            className="text-xs bg-secondary-background text-secondary-text px-1 rounded-md"
            placeholder="Enter new name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            className="text-xs bg-tertiary-background hover:bg-tertiary-background/70 text-tertiary-text px-1 rounded-md"
            onClick={handleUpdatePlayerName}
          >
            Save
          </button>
          {validationError && <div className="text-red-500 text-xs bg-gray-700">{validationError}</div>}
        </>
      )}
    </div>
  );
};
