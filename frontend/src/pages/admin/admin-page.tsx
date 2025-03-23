import React from "react";
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

export const AdminPage: React.FC = () => {
  const { eventStore } = useEventDbContext();

  const addEventMutation = useEventMutation();

  function handleDeactivatePlayer(playerId: string) {
    const event: PlayerDeactivated = {
      type: EventTypeEnum.PLAYER_DEACTIVATED,
      time: Date.now(),
      stream: playerId,
      data: null,
    };

    const validateResponse = eventStore.playersReducer.validateDeactivatePlayer(event);
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

    const validateResponse = eventStore.playersReducer.validateReactivatePlayer(event);
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

    const validateResponse = eventStore.gamesReducer.validateDeleteGame(event);
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
      <AllPlayerGamesDistrubution />
      <Users />
      <p>Active players: {eventStore.playersReducer.players.length}</p>
      <p>Removing players is reverable. No games will be deleted.</p>
      <section className="flex flex-col gap-2 mt-2">
        {eventStore.playersReducer.players.map((player) => (
          <div className="flex gap-2" key={player.name}>
            <p>{player.name}</p>
            <button
              className="text-xs bg-red-500 hover:bg-red-700 text-white px-1 rounded-md"
              onClick={() => handleDeactivatePlayer(player.id)}
            >
              Remove
            </button>
          </div>
        ))}
        <p>Inactive players: {eventStore.playersReducer.inactivePlayers.length}</p>
        {eventStore.playersReducer.inactivePlayers.map((player) => (
          <div className="flex gap-2" key={player.name}>
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

      <p>Games: {eventStore.gamesReducer.games.length}</p>
      <p>Deleting games is permanent.</p>
      <section className="flex flex-col-reverse gap-2 mt-2">
        {eventStore.gamesReducer.games.map((game) => (
          <div className="flex gap-2" key={game.id}>
            <p>
              {game.winner} won over {game.loser} {relativeTimeString(new Date(game.playedAt))}
            </p>
            <button
              className="text-xs bg-red-500 hover:bg-red-800 text-white px-1 rounded-md"
              onClick={() => handleDeleteGame(game.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </section>
    </div>
  );
};
