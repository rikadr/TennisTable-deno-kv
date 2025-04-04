import { kv } from "../db.ts";
import { getEventsAfter, getLatestEventTimestamp } from "./event-store.ts";
import { EventType } from "./event-types.ts";

type EventCacheData = { events: EventType[] };
type EventCacheBatch = { batchIndex: number; totalBatches: number; timeCreated: number; value: string };

export class EventCache {
  readonly #CACHE_TTL = 7 * 24 * 60 * 60 * 1_000; // Time to live in ms
  readonly #MAX_CACHE_BATCH_LENGTH = 30_000; // Max value size in kv dv is 64 KiB

  /**
   * Gets events from cache if cache exists.
   * Fetches events from db if no cache exists.
   */
  async getEventData(): Promise<EventCacheData> {
    const latestEvent = await getLatestEventTimestamp();
    const cache = await this.#getEventCache();
    if (cache && cache.events[cache.events.length - 1]?.time === latestEvent) {
      console.log("Event cache hit");
      return cache;
    }
    console.log("Event cache miss");
    const events = await getEventsAfter(0);
    const eventData: EventCacheData = { events };
    await this.#setEventCache(eventData);
    return eventData;
  }

  /**
   * Appends new events to the cache if cache exists.
   * Fetches events from db if no cache exists.
   * New cache is created with the new events appended.
   */
  async appendEventsToEventCache(newEvents: EventType[]): Promise<void> {
    let existingEvents: EventType[] = [];
    const cache = await this.#getEventCache();
    if (cache) {
      console.log("Append to cached events");
      existingEvents = cache.events;
    } else {
      console.log("Append to db fetched events");
      existingEvents = await getEventsAfter(0);
    }

    await this.#setEventCache({ events: [...existingEvents, ...newEvents] });
  }

  async clearCache(): Promise<void> {
    const cacheBatches = kv.list<EventCacheBatch>({ prefix: this.#getCacheKey() });
    for await (const cache of cacheBatches) {
      const key = this.#getCacheKey(cache.value.batchIndex);
      await kv.delete(key);
    }
  }

  async #getEventCache(): Promise<EventCacheData | null> {
    const cacheBatches = await this.#getAllCacheBatches();
    if (cacheBatches.length === 0) {
      return null;
    }
    if (cacheBatches[0].timeCreated + this.#CACHE_TTL < new Date().getTime()) {
      await this.clearCache();
      return null;
    }
    return this.#parseCacheBatches(cacheBatches);
  }

  async #setEventCache(value: EventCacheData): Promise<void> {
    await this.clearCache();
    const cacheBatches = this.#createCacheBatches(value);
    await this.#uploadCacheBatches(cacheBatches);
  }

  async #getAllCacheBatches(): Promise<EventCacheBatch[]> {
    const cacheBatches: EventCacheBatch[] = [];
    let keepFetchingBatches = true;

    while (keepFetchingBatches) {
      const result = await kv.get<EventCacheBatch>(this.#getCacheKey(cacheBatches.length));
      if (!result.value) {
        // Batch not found
        keepFetchingBatches = false;
        continue;
      }
      if (result.value.batchIndex === result.value.totalBatches - 1) {
        // Final batch in cache
        keepFetchingBatches = false;
      }
      cacheBatches.push(result.value);
    }
    return cacheBatches;
  }

  #parseCacheBatches(cacheBatches: EventCacheBatch[]): EventCacheData {
    cacheBatches.sort((a, b) => a.batchIndex - b.batchIndex);
    const stringifiedValue = cacheBatches.reduce((acc, cur) => acc + cur.value, "");
    return JSON.parse(stringifiedValue);
  }

  #getCacheKey(index?: number): string[] {
    const key = ["event-cache"];
    if (index === undefined) {
      return key;
    }
    key.push("batch-index-" + index);
    return key;
  }

  #createCacheBatches(eventData: EventCacheData): { key: string[]; value: EventCacheBatch }[] {
    const now = new Date().getTime();

    const stringifiedValue = JSON.stringify(eventData);
    const totalBatches = Math.floor(stringifiedValue.length / this.#MAX_CACHE_BATCH_LENGTH) + 1;

    const cacheBatches: { key: string[]; value: EventCacheBatch }[] = [];

    for (let i = 0; i < totalBatches; i++) {
      cacheBatches.push({
        key: this.#getCacheKey(i),
        value: {
          batchIndex: i,
          totalBatches: totalBatches,
          timeCreated: now,
          value: stringifiedValue.slice(i * this.#MAX_CACHE_BATCH_LENGTH, (i + 1) * this.#MAX_CACHE_BATCH_LENGTH),
        },
      });
    }
    return cacheBatches;
  }

  async #uploadCacheBatches(cacheBatches: { key: string[]; value: EventCacheBatch }[]): Promise<void> {
    await Promise.all(cacheBatches.map(async ({ key, value }) => await kv.set(key, value)));
  }
}
