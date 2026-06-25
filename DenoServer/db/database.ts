import { EventType } from "../event-store/event-types.ts";

export type User = { username: string; password: string; role: string };

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
  /** Which player (1 or 2) served the first point of the current set. */
  firstServer: 1 | 2;
  startedAt: number | null;
  finishedAt: number | null;
  updatedAt: number;
};

export interface Database {
  // Events
  storeEvent(event: EventType): Promise<void>;
  deleteEvent(time: number): Promise<boolean>;
  updateEvent(oldTime: number, newEvent: EventType): Promise<boolean>;
  getEventsAfter(time: number): Promise<EventType[]>;
  getLatestEventTimestamp(): Promise<number | null>;
  getAllEntries(): Promise<{ key: unknown[]; value: unknown }[]>;
  deleteAllEvents(): Promise<number>;

  // Users
  createUser(username: string, password: string, role: string): Promise<User>;
  getUser(username: string): Promise<User | null>;
  deleteUser(username: string): Promise<void>;
  updateUser(username: string, data: Partial<Omit<User, "username">>): Promise<void>;
  findAllUsers(): Promise<Omit<User, "password">[]>;

  // Live Game
  getLiveGame(): Promise<LiveGameState | null>;
  setLiveGame(state: LiveGameState): Promise<void>;
  clearLiveGame(): Promise<void>;

  // Key-Value (for gamebot cursor, etc.)
  getValue<T>(key: string): Promise<T | null>;
  setValue<T>(key: string, value: T): Promise<void>;
}
