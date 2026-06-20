import { db } from "../db.ts";

export type { SetPoint, LiveGameState } from "../db/database.ts";
import type { LiveGameState } from "../db/database.ts";

export async function getLiveGame(): Promise<LiveGameState | null> {
  return db.getLiveGame();
}

export async function setLiveGame(state: LiveGameState): Promise<void> {
  await db.setLiveGame(state);
}

export async function clearLiveGame(): Promise<void> {
  await db.clearLiveGame();
}
