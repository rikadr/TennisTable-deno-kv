import { getDb } from "../db.ts";

export type { SetPoint, LiveGameState } from "../db/database.ts";
import type { LiveGameState } from "../db/database.ts";

export async function getLiveGame(client: string): Promise<LiveGameState | null> {
  return getDb(client).getLiveGame();
}

export async function setLiveGame(client: string, state: LiveGameState): Promise<void> {
  await getDb(client).setLiveGame(state);
}

export async function clearLiveGame(client: string): Promise<void> {
  await getDb(client).clearLiveGame();
}
