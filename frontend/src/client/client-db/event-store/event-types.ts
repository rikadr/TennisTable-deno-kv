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
  GAME_SCORE = "GAME_SCORE",

  // Tournament events
  TOURNAMENT_CREATED = "TOURNAMENT_CREATED",
  TOURNAMENT_UPDATED = "TOURNAMENT_UPDATED",
  TOURNAMENT_DELETED = "TOURNAMENT_DELETED",
  TOURNAMENT_SET_PLAYER_ORDER = "TOURNAMENT_SET_PLAYER_ORDER",
  TOURNAMENT_SIGNUP = "TOURNAMENT_SIGNUP",
  TOURNAMENT_CANCEL_SIGNUP = "TOURNAMENT_CANCEL_SIGNUP",
  TOURNAMENT_SKIP_GAME = "TOURNAMENT_SKIP_GAME",
  TOURNAMENT_UNDO_SKIP_GAME = "TOURNAMENT_UNDO_SKIP_GAME",
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
export type PlayerNameUpdated = GenericEvent<EventTypeEnum.PLAYER_NAME_UPDATED, { updatedName: string }>;

export type GameCreated = GenericEvent<EventTypeEnum.GAME_CREATED, { playedAt: number; winner: string; loser: string }>;
export type GameDeleted = GenericEvent<EventTypeEnum.GAME_DELETED, null>;
export type GameScore = GenericEvent<
  EventTypeEnum.GAME_SCORE,
  {
    setsWon: { gameWinner: number; gameLoser: number };
    setPoints?: { gameWinner: number; gameLoser: number }[];
    /**
     * Point-by-point log, one string per set in the order the sets were played.
     * Each char is one point in the order it was scored: "W" = point to the game
     * winner, "L" = point to the game loser. The end of a string is the moment
     * the set was won. Requires setPoints, and each string must count up to the
     * corresponding set's points.
     */
    pointSequences?: string[];
  }
>;

export type TournamentCreated = GenericEvent<
  EventTypeEnum.TOURNAMENT_CREATED,
  {
    name: string;
    description?: string;
    startDate: number;
    groupPlay: boolean;
    overridePreferredGroupSize?: number;
    doubleElimination?: boolean;
  }
>;
export type TournamentUpdated = GenericEvent<
  EventTypeEnum.TOURNAMENT_UPDATED,
  {
    name?: string;
    description?: string;
    startDate?: number;
    groupPlay?: boolean;
    overridePreferredGroupSize?: number;
    doubleElimination?: boolean;
  }
>;
export type TournamentDeleted = GenericEvent<EventTypeEnum.TOURNAMENT_DELETED, null>;
export type TournamentSetPlayerOrder = GenericEvent<
  EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
  { playerOrder: string[] }
>;

export type TournamentSignup = GenericEvent<EventTypeEnum.TOURNAMENT_SIGNUP, { player: string }>;
export type TournamentCancelSignup = GenericEvent<EventTypeEnum.TOURNAMENT_CANCEL_SIGNUP, { player: string }>;
export type TournamentSkipGame = GenericEvent<
  EventTypeEnum.TOURNAMENT_SKIP_GAME,
  { skipId: string; winner: string; loser: string }
>;
export type TournamentUndoSkipGame = GenericEvent<EventTypeEnum.TOURNAMENT_UNDO_SKIP_GAME, { skipId: string }>;

export type EventType =
  | PlayerCreated
  | PlayerDeactivated
  | PlayerReactivated
  | PlayerNameUpdated
  | GameCreated
  | GameDeleted
  | GameScore
  | TournamentCreated
  | TournamentUpdated
  | TournamentDeleted
  | TournamentSetPlayerOrder
  | TournamentSignup
  | TournamentCancelSignup
  | TournamentSkipGame
  | TournamentUndoSkipGame;
