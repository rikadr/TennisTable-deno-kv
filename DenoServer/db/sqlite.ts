import { Database as SqliteDb } from "@db/sqlite";
import type { Database, LiveGameState, User } from "./database.ts";
import type { EventType } from "../event-store/event-types.ts";

interface EventRow {
  time: number;
  stream: string;
  type: string;
  data: string;
}

export class SqliteDatabase implements Database {
  private db: SqliteDb;

  constructor(path: string) {
    // Ensure the parent directory exists — @db/sqlite creates the DB file but
    // not its parent dir, and git doesn't track empty dirs so it may be absent.
    const dir = path.slice(0, path.lastIndexOf("/"));
    if (dir) {
      Deno.mkdirSync(dir, { recursive: true });
    }
    // int64: true is REQUIRED — event times are ms-since-epoch (~1.7e12), which
    // exceed 32 bits. Without this, @db/sqlite reads integer columns via the
    // 32-bit sqlite3_column_int and silently truncates them (e.g. 1715674898853
    // -> 1982947749, or negative). Writes already bind as int64, so on-disk data
    // is correct; this only fixes the read path. Values stay within
    // Number.MAX_SAFE_INTEGER, so they come back as regular numbers (not BigInt).
    this.db = new SqliteDb(path, { int64: true });
    this.db.exec("PRAGMA journal_mode = WAL");
    this.createTables();
  }

  private createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        time    INTEGER PRIMARY KEY,
        stream  TEXT NOT NULL,
        type    TEXT NOT NULL,
        data    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role     TEXT NOT NULL DEFAULT 'user'
      );

      CREATE TABLE IF NOT EXISTS live_game (
        id    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        state TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS key_value (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  // Events

  async storeEvent(event: EventType): Promise<void> {
    try {
      this.db.prepare(
        "INSERT INTO events (time, stream, type, data) VALUES (?, ?, ?, ?)",
      ).run(event.time, event.stream, event.type, JSON.stringify(event.data));
    } catch (e) {
      if (e instanceof Error && e.message.includes("UNIQUE constraint")) {
        throw new Error(`Event with time ${event.time} already exists`);
      }
      throw e;
    }
  }

  async deleteEvent(time: number): Promise<boolean> {
    const changes = this.db.prepare("DELETE FROM events WHERE time = ?").run(time);
    return changes > 0;
  }

  async updateEvent(oldTime: number, newEvent: EventType): Promise<boolean> {
    this.db.exec("BEGIN");
    try {
      const deleted = this.db.prepare("DELETE FROM events WHERE time = ?").run(oldTime);
      if (deleted === 0) {
        this.db.exec("ROLLBACK");
        return false;
      }
      this.db.prepare(
        "INSERT INTO events (time, stream, type, data) VALUES (?, ?, ?, ?)",
      ).run(newEvent.time, newEvent.stream, newEvent.type, JSON.stringify(newEvent.data));
      this.db.exec("COMMIT");
      return true;
    } catch {
      this.db.exec("ROLLBACK");
      return false;
    }
  }

  async getEventsAfter(time: number): Promise<EventType[]> {
    const rows = this.db.prepare(
      "SELECT time, stream, type, data FROM events WHERE time > ? ORDER BY time ASC",
    ).all<EventRow>(time);

    return rows.map((row) => ({
      time: row.time,
      stream: row.stream,
      type: row.type,
      data: JSON.parse(row.data),
    })) as EventType[];
  }

  async getLatestEventTimestamp(): Promise<number | null> {
    const row = this.db.prepare(
      "SELECT time FROM events ORDER BY time DESC LIMIT 1",
    ).get<{ time: number }>();
    return row ? row.time : null;
  }

  async deleteAllEvents(): Promise<number> {
    const count = this.db.prepare("SELECT COUNT(*) as cnt FROM events").get<{ cnt: number }>();
    this.db.exec("DELETE FROM events");
    return count ? count.cnt : 0;
  }

  // Users

  async createUser(username: string, password: string, role: string): Promise<User> {
    this.db.prepare(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
    ).run(username, password, role);
    return { username, password, role };
  }

  async getUser(username: string): Promise<User | null> {
    const row = this.db.prepare(
      "SELECT username, password, role FROM users WHERE username = ?",
    ).get<User>(username);
    return row ?? null;
  }

  async deleteUser(username: string): Promise<void> {
    this.db.prepare("DELETE FROM users WHERE username = ?").run(username);
  }

  async updateUser(username: string, data: Partial<Omit<User, "username">>): Promise<void> {
    const existing = await this.getUser(username);
    if (!existing) {
      throw new Error("User not found");
    }
    const updated = { ...existing, ...data };
    this.db.prepare(
      "UPDATE users SET password = ?, role = ? WHERE username = ?",
    ).run(updated.password, updated.role, username);
  }

  async findAllUsers(): Promise<Omit<User, "password">[]> {
    return this.db.prepare(
      "SELECT username, role FROM users",
    ).all<{ username: string; role: string }>();
  }

  // Live Game

  async getLiveGame(): Promise<LiveGameState | null> {
    const row = this.db.prepare(
      "SELECT state FROM live_game WHERE id = 1",
    ).get<{ state: string }>();
    return row ? JSON.parse(row.state) : null;
  }

  async setLiveGame(state: LiveGameState): Promise<void> {
    this.db.prepare(
      "INSERT OR REPLACE INTO live_game (id, state) VALUES (1, ?)",
    ).run(JSON.stringify(state));
  }

  async clearLiveGame(): Promise<void> {
    this.db.prepare("DELETE FROM live_game WHERE id = 1").run();
  }

  // Key-Value

  async getValue<T>(key: string): Promise<T | null> {
    const row = this.db.prepare(
      "SELECT value FROM key_value WHERE key = ?",
    ).get<{ value: string }>(key);
    return row ? JSON.parse(row.value) as T : null;
  }

  async setValue<T>(key: string, value: T): Promise<void> {
    this.db.prepare(
      "INSERT OR REPLACE INTO key_value (key, value) VALUES (?, ?)",
    ).run(key, JSON.stringify(value));
  }
}
