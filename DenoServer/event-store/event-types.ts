export enum EventTypeEnum {
  // Player events
  PLAYER_CREATED = "PLAYER_CREATED",
  PLAYER_DEACTIVATED = "PLAYER_DEACTIVATED",
  PLAYER_REACTIVATED = "PLAYER_REACTIVATED",
  PLAYER_NAME_UPDATED = "PLAYER_NAME_UPDATED",

  // Game events
  GAME_CREATED = "GAME_CREATED",
  // GAME_UPDATED = "GAME_UPDATED",
  GAME_DELETED = "GAME_DELETED",

  // Tournament events
  TOURNAMENT_SIGNUP = "TOURNAMENT_SIGNUP",
  TOURNAMENT_CANCEL_SIGNUP = "TOURNAMENT_CANCEL_SIGNUP",
}

type GenericEvent<Type extends EventTypeEnum = EventTypeEnum, Data = unknown> = {
  time: number; // Must be unique. Used as key in the KV store
  stream: string;
  type: Type;
  data: Data;
};

export type EventType = GenericEvent;
