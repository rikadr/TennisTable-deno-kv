import { BadSide } from "../../common/table-sides";

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
  /** Epoch ms of each point of the current set, parallel to currentSetSequence. */
  currentSetPointTimes: number[];
  /** Point sequence of each completed set, same encoding as currentSetSequence. */
  completedSetSequences: string[];
  /** Point times of each completed set, same encoding as currentSetPointTimes. */
  completedSetPointTimes: number[][];
  /** Which player (1 or 2) served the first point of each completed set. */
  completedSetFirstServers: (1 | 2)[];
  /** Which player (1 or 2) served the first point of the current set. */
  firstServer: 1 | 2;
  /** Who had the bad side of the table in each completed set. */
  completedSetBadSides: BadSide[];
  /**
   * Who has the bad side of the table in the current set. Null until somebody
   * records it, because the sides are not known for every game.
   */
  badSide: BadSide;
  /** How many points were undone while tracking this match. */
  corrections: number;
  startedAt: number | null;
  /** Epoch ms the match was ended for review. Null while it is still played. */
  endedAt: number | null;
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
  currentSetPointTimes: [],
  completedSetSequences: [],
  completedSetPointTimes: [],
  completedSetFirstServers: [],
  firstServer: 1,
  completedSetBadSides: [],
  badSide: null,
  corrections: 0,
  startedAt: null,
  endedAt: null,
  finishedAt: null,
  updatedAt: 0,
};
