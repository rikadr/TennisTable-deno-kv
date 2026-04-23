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
  startedAt: null,
  finishedAt: null,
  updatedAt: 0,
};
