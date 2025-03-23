// Copy pasted from the backend

export enum EventTypeEnum {
  // Player events
  PLAYER_CREATED = "PLAYER_CREATED",
  // PLAYER_UPDATED = "PLAYER_UPDATED",
  PLAYER_DEACTIVATED = "PLAYER_DEACTIVATED",
  PLAYER_REACTIVATED = "PLAYER_REACTIVATED",

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

export type PlayerCreated = GenericEvent<EventTypeEnum.PLAYER_CREATED, { name: string }>;
export type PlayerDeactivated = GenericEvent<EventTypeEnum.PLAYER_DEACTIVATED, null>;
export type PlayerReactivated = GenericEvent<EventTypeEnum.PLAYER_REACTIVATED, null>;

export type GameCreated = GenericEvent<EventTypeEnum.GAME_CREATED, { playedAt: number; winner: string; loser: string }>; // Score???
export type GameDeleted = GenericEvent<EventTypeEnum.GAME_DELETED, null>;

export type TournamentSignup = GenericEvent<EventTypeEnum.TOURNAMENT_SIGNUP, { player: string }>;
export type TournamentCancelSignup = GenericEvent<EventTypeEnum.TOURNAMENT_CANCEL_SIGNUP, null>;

export type EventType =
  | PlayerCreated
  | PlayerDeactivated
  | PlayerReactivated
  | GameCreated
  | GameDeleted
  | TournamentSignup
  | TournamentCancelSignup;
