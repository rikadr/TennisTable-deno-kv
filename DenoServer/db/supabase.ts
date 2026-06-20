import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database, LiveGameState, User } from "./database.ts";
import type { EventType } from "../event-store/event-types.ts";

interface EventRow {
  time: number;
  stream: string;
  type: string;
  data: Record<string, unknown>;
}

export class SupabaseDatabase implements Database {
  private client: SupabaseClient;
  private clientId: string;

  constructor(url: string, apiKey: string, clientId: string) {
    this.client = createClient(url, apiKey, {
      global: {
        headers: { apikey: apiKey },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    this.clientId = clientId;
  }

  // Events

  async storeEvent(event: EventType): Promise<void> {
    const { error } = await this.client.from("events").insert({
      client_id: this.clientId,
      time: event.time,
      stream: event.stream,
      type: event.type,
      data: event.data,
    });
    if (error) {
      throw new Error(`Failed to store event: ${error.message}`);
    }
  }

  async deleteEvent(time: number): Promise<boolean> {
    const { data } = await this.client
      .from("events")
      .delete()
      .eq("client_id", this.clientId)
      .eq("time", time)
      .select("time");
    return (data?.length ?? 0) > 0;
  }

  async updateEvent(oldTime: number, newEvent: EventType): Promise<boolean> {
    const { data: deleted } = await this.client
      .from("events")
      .delete()
      .eq("client_id", this.clientId)
      .eq("time", oldTime)
      .select("time");

    if (!deleted?.length) {
      return false;
    }

    const { error } = await this.client.from("events").insert({
      client_id: this.clientId,
      time: newEvent.time,
      stream: newEvent.stream,
      type: newEvent.type,
      data: newEvent.data,
    });

    if (error) {
      console.error(`Failed to insert updated event after deleting old one (time=${oldTime}):`, error.message);
      return false;
    }

    return true;
  }

  async getEventsAfter(time: number): Promise<EventType[]> {
    const { data, error } = await this.client
      .from("events")
      .select("time, stream, type, data")
      .eq("client_id", this.clientId)
      .gt("time", time)
      .order("time", { ascending: true });

    if (error) {
      throw new Error(`Failed to get events: ${error.message}`);
    }

    return (data as EventRow[]).map((row) => ({
      time: row.time,
      stream: row.stream,
      type: row.type,
      data: row.data,
    })) as EventType[];
  }

  async getLatestEventTimestamp(): Promise<number | null> {
    const { data, error } = await this.client
      .from("events")
      .select("time")
      .eq("client_id", this.clientId)
      .order("time", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to get latest event: ${error.message}`);
    }

    return data?.length ? data[0].time : null;
  }

  async getAllEntries(): Promise<{ key: unknown[]; value: unknown }[]> {
    const entries: { key: unknown[]; value: unknown }[] = [];

    const { data: events } = await this.client
      .from("events")
      .select("time, stream, type, data")
      .eq("client_id", this.clientId)
      .order("time", { ascending: true });

    for (const row of events ?? []) {
      entries.push({
        key: ["event", row.time],
        value: { time: row.time, stream: row.stream, type: row.type, data: row.data },
      });
    }

    const { data: users } = await this.client
      .from("users")
      .select("username, password, role")
      .eq("client_id", this.clientId);

    for (const row of users ?? []) {
      entries.push({
        key: ["user", row.username],
        value: row,
      });
    }

    const { data: liveGame } = await this.client
      .from("live_game")
      .select("state")
      .eq("client_id", this.clientId)
      .maybeSingle();

    if (liveGame) {
      entries.push({ key: ["live-game"], value: liveGame.state });
    }

    const { data: kvEntries } = await this.client
      .from("key_value")
      .select("key, value")
      .eq("client_id", this.clientId);

    for (const row of kvEntries ?? []) {
      entries.push({ key: [row.key], value: row.value });
    }

    return entries;
  }

  async deleteAllEvents(): Promise<number> {
    const { data } = await this.client
      .from("events")
      .delete()
      .eq("client_id", this.clientId)
      .gte("time", 0)
      .select("time");
    return data?.length ?? 0;
  }

  // Users

  async createUser(username: string, password: string, role: string): Promise<User> {
    const { error } = await this.client
      .from("users")
      .insert({ client_id: this.clientId, username, password, role });
    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
    return { username, password, role };
  }

  async getUser(username: string): Promise<User | null> {
    const { data } = await this.client
      .from("users")
      .select("username, password, role")
      .eq("client_id", this.clientId)
      .eq("username", username)
      .maybeSingle();
    return data as User | null;
  }

  async deleteUser(username: string): Promise<void> {
    await this.client.from("users").delete()
      .eq("client_id", this.clientId)
      .eq("username", username);
  }

  async updateUser(username: string, data: Partial<Omit<User, "username">>): Promise<void> {
    const existing = await this.getUser(username);
    if (!existing) {
      throw new Error("User not found");
    }
    const { error } = await this.client
      .from("users")
      .update(data)
      .eq("client_id", this.clientId)
      .eq("username", username);
    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async findAllUsers(): Promise<Omit<User, "password">[]> {
    const { data, error } = await this.client
      .from("users")
      .select("username, role")
      .eq("client_id", this.clientId);
    if (error) {
      throw new Error(`Failed to find users: ${error.message}`);
    }
    return data as Omit<User, "password">[];
  }

  // Live Game

  async getLiveGame(): Promise<LiveGameState | null> {
    const { data } = await this.client
      .from("live_game")
      .select("state")
      .eq("client_id", this.clientId)
      .maybeSingle();
    return data?.state as LiveGameState | null;
  }

  async setLiveGame(state: LiveGameState): Promise<void> {
    const { error } = await this.client
      .from("live_game")
      .upsert({ client_id: this.clientId, state });
    if (error) {
      throw new Error(`Failed to set live game: ${error.message}`);
    }
  }

  async clearLiveGame(): Promise<void> {
    await this.client.from("live_game").delete().eq("client_id", this.clientId);
  }

  // Key-Value

  async getValue<T>(key: string): Promise<T | null> {
    const { data } = await this.client
      .from("key_value")
      .select("value")
      .eq("client_id", this.clientId)
      .eq("key", key)
      .maybeSingle();
    return data?.value as T | null;
  }

  async setValue<T>(key: string, value: T): Promise<void> {
    const { error } = await this.client
      .from("key_value")
      .upsert({ client_id: this.clientId, key, value });
    if (error) {
      throw new Error(`Failed to set value: ${error.message}`);
    }
  }
}
