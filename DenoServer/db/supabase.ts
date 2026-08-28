import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database, LiveGameState, PushSubscriptionRecord, User } from "./database.ts";
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
    // Supabase has no client-side transactions, so order the operations to
    // fail safe: the old event is never deleted before the new one is stored.
    if (newEvent.time === oldTime) {
      const { data, error } = await this.client
        .from("events")
        .update({ stream: newEvent.stream, type: newEvent.type, data: newEvent.data })
        .eq("client_id", this.clientId)
        .eq("time", oldTime)
        .select("time");

      if (error) {
        console.error(`Failed to update event (time=${oldTime}):`, error.message);
        return false;
      }
      return (data?.length ?? 0) > 0;
    }

    const { data: existing } = await this.client
      .from("events")
      .select("time")
      .eq("client_id", this.clientId)
      .eq("time", oldTime)
      .maybeSingle();

    if (!existing) {
      return false;
    }

    const { error: insertError } = await this.client.from("events").insert({
      client_id: this.clientId,
      time: newEvent.time,
      stream: newEvent.stream,
      type: newEvent.type,
      data: newEvent.data,
    });

    if (insertError) {
      console.error(`Failed to insert updated event (old time=${oldTime}):`, insertError.message);
      return false;
    }

    const { error: deleteError } = await this.client
      .from("events")
      .delete()
      .eq("client_id", this.clientId)
      .eq("time", oldTime);

    if (deleteError) {
      // Remove the just-inserted event so the update does not leave both versions behind
      const { error: rollbackError } = await this.client
        .from("events")
        .delete()
        .eq("client_id", this.clientId)
        .eq("time", newEvent.time);
      console.error(`Failed to delete old event after inserting update (time=${oldTime}):`, deleteError.message);
      if (rollbackError) {
        console.error(
          `Rollback failed too - events ${oldTime} and ${newEvent.time} both exist and need manual cleanup:`,
          rollbackError.message,
        );
      }
      return false;
    }

    return true;
  }

  async getEventsAfter(time: number): Promise<EventType[]> {
    const rows: EventRow[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await this.client
        .from("events")
        .select("time, stream, type, data")
        .eq("client_id", this.clientId)
        .gt("time", time)
        .order("time", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        throw new Error(`Failed to get events: ${error.message}`);
      }

      rows.push(...(data as EventRow[]));
      if (data.length < pageSize) break;
      from += pageSize;
    }

    return rows.map((row) => ({
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

  // Push subscriptions

  async savePushSubscription(record: PushSubscriptionRecord): Promise<void> {
    const { error } = await this.client.from("push_subscriptions").upsert({
      client_id: this.clientId,
      endpoint: record.endpoint,
      device_id: record.deviceId,
      subscription: record.subscription,
      created_at: record.createdAt,
    });
    if (error) {
      throw new Error(`Failed to save push subscription: ${error.message}`);
    }
  }

  async deletePushSubscription(endpoint: string): Promise<boolean> {
    const { data } = await this.client
      .from("push_subscriptions")
      .delete()
      .eq("client_id", this.clientId)
      .eq("endpoint", endpoint)
      .select("endpoint");
    return (data?.length ?? 0) > 0;
  }

  async getAllPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
    const { data, error } = await this.client
      .from("push_subscriptions")
      .select("endpoint, device_id, subscription, created_at")
      .eq("client_id", this.clientId);
    if (error) {
      throw new Error(`Failed to get push subscriptions: ${error.message}`);
    }

    const rows = (data ?? []) as {
      endpoint: string;
      device_id: string | null;
      subscription: PushSubscriptionRecord["subscription"];
      created_at: number;
    }[];
    return rows.map((row) => ({
      endpoint: row.endpoint,
      deviceId: row.device_id,
      subscription: row.subscription,
      createdAt: row.created_at,
    }));
  }
}
