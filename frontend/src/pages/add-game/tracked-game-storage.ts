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

/**
 * The stream and the time of a save that started. The server can have the
 * game, its score, both or none, so a retry uses the same values and first
 * reads what the server has.
 */
export type PendingSave = { stream: string; playedAt: number };

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
  /** Set before the first request of a save, and kept until the save is complete. */
  pendingSave: PendingSave | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSetPoints(value: unknown): value is TrackedSetPoints {
  return isRecord(value) && typeof value.player1 === "number" && typeof value.player2 === "number";
}

function isTrackedSet(value: unknown): value is TrackedSet {
  return (
    isRecord(value) &&
    typeof value.sequence === "string" &&
    /^[12]*$/.test(value.sequence) &&
    Array.isArray(value.pointTimes) &&
    value.pointTimes.length === value.sequence.length &&
    value.pointTimes.every((time) => typeof time === "number")
  );
}

function isServer(value: unknown): value is Server {
  return value === 1 || value === 2;
}

function isBadSide(value: unknown): value is BadSide {
  return value === 1 || value === 2 || value === "neutral" || value === null;
}

/** Each completed set has its points, its first server and its side, and one winner. */
function isMatchData(value: unknown): value is MatchData {
  if (!isRecord(value)) return false;
  const { setsWon, setPoints, trackedSets, firstServers, badSides } = value;
  return (
    isSetPoints(setsWon) &&
    Array.isArray(setPoints) &&
    setPoints.every(isSetPoints) &&
    setsWon.player1 + setsWon.player2 === setPoints.length &&
    Array.isArray(trackedSets) &&
    trackedSets.length === setPoints.length &&
    trackedSets.every(isTrackedSet) &&
    Array.isArray(firstServers) &&
    firstServers.length === setPoints.length &&
    firstServers.every(isServer) &&
    Array.isArray(badSides) &&
    badSides.length === setPoints.length &&
    badSides.every(isBadSide)
  );
}

function isPendingSave(value: unknown): value is PendingSave {
  return isRecord(value) && typeof value.stream === "string" && typeof value.playedAt === "number";
}

function isStoredTrackedGame(value: unknown): value is StoredTrackedGame {
  return (
    isRecord(value) &&
    typeof value.player1 === "string" &&
    typeof value.player2 === "string" &&
    isMatchData(value.matchData) &&
    isSetPoints(value.currentSetScore) &&
    isTrackedSet(value.currentTrackedSet) &&
    isServer(value.firstServer) &&
    isBadSide(value.badSide) &&
    typeof value.startedAt === "number" &&
    typeof value.corrections === "number" &&
    (value.pendingSave === null || isPendingSave(value.pendingSave))
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

/** Returns false when the device did not store the game, e.g. on a full quota. */
export function saveTrackedGame(game: StoredTrackedGame): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    return true;
  } catch (error) {
    console.error("Failed to save the tracked game", error);
    return false;
  }
}

export function clearTrackedGame() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear the tracked game", error);
  }
}
