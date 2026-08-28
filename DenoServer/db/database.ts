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
  /**
   * Who had the bad side of the table in each completed set: 1 or 2 for that
   * player, "neutral" when the 2 sides are equally good, and null when nobody
   * recorded the sides.
   */
  completedSetBadSides: (1 | 2 | "neutral" | null)[];
  /** Who has the bad side of the table in the current set. */
  badSide: 1 | 2 | "neutral" | null;
  /** How many points were undone while tracking this match. */
  corrections: number;
  startedAt: number | null;
  /** Epoch ms the match was ended for review. Null while it is still played. */
  endedAt: number | null;
  finishedAt: number | null;
  updatedAt: number;
};

export type PushSubscriptionRecord = {
  /** The push service URL. Unique per subscription — used as the key. */
  endpoint: string;
  /** The subscribing device's id, so its own events do not notify it. */
  deviceId: string | null;
  /** The browser's PushSubscription JSON, everything needed to send to it. */
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  createdAt: number;
};

export interface Database {
  // Events
  storeEvent(event: EventType): Promise<void>;
  deleteEvent(time: number): Promise<boolean>;
  updateEvent(oldTime: number, newEvent: EventType): Promise<boolean>;
  getEventsAfter(time: number): Promise<EventType[]>;
  getLatestEventTimestamp(): Promise<number | null>;
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

  // Push subscriptions
  savePushSubscription(record: PushSubscriptionRecord): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<boolean>;
  getAllPushSubscriptions(): Promise<PushSubscriptionRecord[]>;
}
