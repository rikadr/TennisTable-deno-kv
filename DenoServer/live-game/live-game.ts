import { kv } from "../db.ts";

export type SetPoint = {
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
  currentSet: SetPoint;
  completedSets: SetPoint[];
  startedAt: number | null;
  updatedAt: number;
};

const LIVE_GAME_KEY = ["live-game"];

export async function getLiveGame(): Promise<LiveGameState | null> {
  const result = await kv.get<LiveGameState>(LIVE_GAME_KEY);
  return result.value;
}

export async function setLiveGame(state: LiveGameState): Promise<void> {
  await kv.set(LIVE_GAME_KEY, state);
}

export async function clearLiveGame(): Promise<void> {
  await kv.delete(LIVE_GAME_KEY);
}
