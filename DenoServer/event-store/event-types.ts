// Copy pasted from the frontend

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
/**
 * What the live trackers recorded while the points were logged: when each point
 * was scored, who served, and how much the log was corrected. Always stored
 * together with `pointSequences`.
 */
export type GameTracking = {
  /** Schema version of this object, so the format can change later. */
  version: 1;
  /** Which tracker logged the points. */
  source: "track-game" | "live-game";
  /** Epoch ms when tracking started. The only absolute time in the object. */
  startedAt: number;
  /**
   * One array per set, parallel to `pointSequences`. Each number is the tenths
   * of a second since the previous point of the game, across set boundaries.
   */
  pointDeltas: number[][];
  /** Tenths of a second from the last point to the end of the match. */
  endedAfter: number;
  /** Who served the first point of each set: "W" = game winner, "L" = game loser. */
  firstServers: string;
  /** How many points were undone while tracking. */
  corrections: number;
};

export type GameScore = GenericEvent<
  EventTypeEnum.GAME_SCORE,
  {
    setsWon: { gameWinner: number; gameLoser: number };
    setPoints?: { gameWinner: number; gameLoser: number }[];
    /**
     * Which side of the table the game winner had in each set, one entry per
     * set in the order the sets were played: "G" = the good side, "B" = the
     * bad side, "N" = the 2 sides are equally good, null = not recorded.
     * Independent of `setPoints`. Left out when no set has a recorded side.
     */
    gameWinnerSides?: ("G" | "B" | "N" | null)[];
    /**
     * Point-by-point log, one string per set in the order the sets were played.
     * Each char is one point in the order it was scored: "W" = point to the game
     * winner, "L" = point to the game loser. A string ends when the set was
     * marked won — the last char is not necessarily the set winner's point.
     */
    pointSequences?: string[];
    /** Timing and serve data of the same points. Requires pointSequences. */
    tracking?: GameTracking;
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
