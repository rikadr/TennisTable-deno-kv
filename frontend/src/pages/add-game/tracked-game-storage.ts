import { TrackedSet, TrackedSetPoints } from "../../common/point-sequences";
import { Server } from "../../common/serve-tracker";
import { BadSide } from "../../common/table-sides";

const STORAGE_KEY = "tennis-table-tracked-game";

export interface MatchData {
  setsWon: TrackedSetPoints;
  setPoints?: TrackedSetPoints[];
  /** Points of each completed set, in scoring order, and when each was scored. */
  trackedSets: TrackedSet[];
  /** Who served the first point of each completed set. */
  firstServers: Server[];
  /** Who had the bad side of the table in each completed set. */
  badSides: BadSide[];
}

/** The GAME_CREATED event of a tracked game that the server already has. */
export type CreatedGame = { stream: string; playedAt: number; winner: string };

/**
 * A tracked game in progress. The tracker saves it after every change, so a
 * player who leaves the page can return and continue.
 */
export type StoredTrackedGame = {
  player1: string;
  player2: string;
  matchData: MatchData;
  currentSetScore: TrackedSetPoints;
  currentTrackedSet: TrackedSet;
  firstServer: Server;
  badSide: BadSide;
  startedAt: number;
  corrections: number;
  /**
   * Set when the game was created but its score did not reach the server. The
   * next save sends only the score, so the game is not created twice.
   */
  createdGame: CreatedGame | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSetPoints(value: unknown): value is TrackedSetPoints {
  return isRecord(value) && typeof value.player1 === "number" && typeof value.player2 === "number";
}

function isTrackedSet(value: unknown): value is TrackedSet {
  return isRecord(value) && typeof value.sequence === "string" && Array.isArray(value.pointTimes);
}

function isStoredTrackedGame(value: unknown): value is StoredTrackedGame {
  if (!isRecord(value) || !isRecord(value.matchData)) return false;
  const { matchData } = value;
  return (
    typeof value.player1 === "string" &&
    typeof value.player2 === "string" &&
    isSetPoints(matchData.setsWon) &&
    Array.isArray(matchData.setPoints) &&
    matchData.setPoints.every(isSetPoints) &&
    Array.isArray(matchData.trackedSets) &&
    matchData.trackedSets.every(isTrackedSet) &&
    Array.isArray(matchData.firstServers) &&
    Array.isArray(matchData.badSides) &&
    isSetPoints(value.currentSetScore) &&
    isTrackedSet(value.currentTrackedSet) &&
    (value.firstServer === 1 || value.firstServer === 2) &&
    typeof value.startedAt === "number" &&
    typeof value.corrections === "number"
  );
}

/** The tracked game in progress on this device, or null when there is none. */
export function loadTrackedGame(): StoredTrackedGame | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isStoredTrackedGame(parsed)) return parsed;
  } catch (error) {
    console.error("Failed to read the tracked game", error);
  }
  // Data the tracker cannot continue from would redirect to it forever.
  clearTrackedGame();
  return null;
}

export function saveTrackedGame(game: StoredTrackedGame) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  } catch (error) {
    console.error("Failed to save the tracked game", error);
  }
}

export function clearTrackedGame() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear the tracked game", error);
  }
}
