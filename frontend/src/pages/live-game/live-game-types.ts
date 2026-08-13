export type LiveGameSetPoint = {
  player1: number;
  player2: number;
};

export type LiveGameState = {
  player1Id: string | null;
  player2Id: string | null;
  setsWon: {
    player1: number;
    player2: number;
  };
  currentSet: LiveGameSetPoint;
  completedSets: LiveGameSetPoint[];
  /**
   * One char per point of the current set in the order the points were scored:
   * "1" = point to player 1, "2" = point to player 2.
   */
  currentSetSequence: string;
  /** Point sequence of each completed set, same encoding as currentSetSequence. */
  completedSetSequences: string[];
  /** Which player (1 or 2) served the first point of the current set. */
  firstServer: 1 | 2;
  startedAt: number | null;
  finishedAt: number | null;
  updatedAt: number;
};

export const emptyLiveGame: LiveGameState = {
  player1Id: null,
  player2Id: null,
  setsWon: { player1: 0, player2: 0 },
  currentSet: { player1: 0, player2: 0 },
  completedSets: [],
  currentSetSequence: "",
  completedSetSequences: [],
  firstServer: 1,
  startedAt: null,
  finishedAt: null,
  updatedAt: 0,
};
