import React, { useState } from "react";
import { queryClient } from "../../common/query-client";
import { relativeTimeString } from "../../common/date-utils";
import { Users } from "../users";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { session } from "../../services/auth";
import { AllPlayerGamesDistrubution } from "./all-player-games-distribution";
import { useEventMutation } from "../../hooks/use-event-mutation";
import {
  EventTypeEnum,
  GameDeleted,
  PlayerDeactivated,
  PlayerReactivated,
} from "../../client/client-db/event-store/event-types";
import { EditPlayerName } from "./edit-player-name";

export const AdminPage: React.FC = () => {
  const context = useEventDbContext();

  const addEventMutation = useEventMutation();

  const [showGames, setShowGames] = useState(false);

  function handleDeactivatePlayer(playerId: string) {
    const event: PlayerDeactivated = {
      type: EventTypeEnum.PLAYER_DEACTIVATED,
      time: Date.now(),
      stream: playerId,
      data: null,
    };

    const validateResponse = context.eventStore.playersReducer.validateDeactivatePlayer(event);
    if (validateResponse.valid === false) {
      console.error(validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, { onSuccess: () => queryClient.invalidateQueries });
  }

  function handleReactivatePlayer(playerId: string) {
    const event: PlayerReactivated = {
      type: EventTypeEnum.PLAYER_REACTIVATED,
      time: Date.now(),
      stream: playerId,
      data: null,
    };

    const validateResponse = context.eventStore.playersReducer.validateReactivatePlayer(event);
    if (validateResponse.valid === false) {
      console.error(validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, { onSuccess: () => queryClient.invalidateQueries });
  }

  function handleDeleteGame(gameId: string) {
    const event: GameDeleted = {
      type: EventTypeEnum.GAME_DELETED,
      time: Date.now(),
      stream: gameId,
      data: null,
    };

    const validateResponse = context.eventStore.gamesReducer.validateDeleteGame(event);
    if (validateResponse.valid === false) {
      console.error(validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, {
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
    });
  }

  if (session.sessionData?.role !== "admin") {
    return <div>Not authorized</div>;
  }

  return (
    <div>
      <h1>ADMIN PAGE</h1>
      <br />
      <h2>Total distribution of games played</h2>
      <button onClick={() => setShowGames(!showGames)}>{showGames ? "Hide" : "Show"}</button>
      {showGames && <AllPlayerGamesDistrubution />}
      <Users />
      <p>Active players: {context.eventStore.playersReducer.players.length}</p>
      <p>
        Deactivating players is reverable. No games will be deleted. It will only result in games with this player not
        counting towards anyone's elo rating.
      </p>
      <section className="flex flex-col gap-2 mt-2">
        {context.eventStore.playersReducer.players.map((player) => (
          <div className="flex gap-2" key={player.id}>
            <p>{player.name}</p>
            <button
              className="text-xs bg-red-500 hover:bg-red-700 text-white px-1 rounded-md"
              onClick={() => handleDeactivatePlayer(player.id)}
            >
              Deactivate
            </button>
            <EditPlayerName playerId={player.id} />
          </div>
        ))}
        <p>Inactive players: {context.eventStore.playersReducer.inactivePlayers.length}</p>
        {context.eventStore.playersReducer.inactivePlayers.map((player) => (
          <div className="flex gap-2" key={player.id}>
            <p>{player.name}</p>
            <button
              className="text-xs bg-gray-400 hover:bg-green-400 text-white px-1 rounded-md"
              onClick={() => handleReactivatePlayer(player.id)}
            >
              Re-activate
            </button>
          </div>
        ))}
      </section>

      <p>Games: {context.eventStore.gamesReducer.games.length}</p>
      <p>
        Deleting games is not permanent BUT I'd prefer not to restore deleted games, so please try to just delete games
        you want to delete.
      </p>
      <section className="flex flex-col-reverse gap-2 mt-2">
        {context.eventStore.gamesReducer.games.map((game) => (
          <div className="flex gap-2" key={game.id}>
            <p>
              {context.eventStore.playersReducer.getPlayer(game.winner)?.name} won over{" "}
              {context.eventStore.playersReducer.getPlayer(game.loser)?.name}{" "}
              {relativeTimeString(new Date(game.playedAt))}
            </p>
            <button
              className="text-xs bg-red-500 hover:bg-red-800 text-white px-1 rounded-md"
              onClick={() =>
                window.confirm(
                  `Are you sure you want to delete the game where ${
                    context.eventStore.playersReducer.getPlayer(game.winner)?.name
                  } won over ${context.eventStore.playersReducer.getPlayer(game.loser)?.name}?`,
                ) && handleDeleteGame(game.id)
              }
            >
              Delete
            </button>
          </div>
        ))}
      </section>
    </div>
  );
};
